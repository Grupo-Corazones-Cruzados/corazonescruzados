'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { evaluarAcceso } from '@/lib/inquilino';
import { INICIO_DE_ROL } from '@/lib/permisos';
import { TIPOS_COMIDA } from '@/lib/catalogo';
import type { RolUsuario } from '@/generated/prisma/enums';
import {
  reconocer, claveGccCorrecta, enviarCodigo, codigoCorrecto,
  passkeyIniciar, passkeyTerminar,
} from '@/lib/identidadGcc';
import {
  abrirSesionUsuario,
  abrirSesionOperador,
  cerrarSesion,
  abrirPasoDos,
  leerPasoDos,
  cerrarPasoDos,
  COOKIE_GCC,
  COOKIE_SESION,
} from '@/lib/sesion';

/**
 * Lo que puede pasar al escribir usuario y contraseña. `segundoPaso` NO es una sesión:
 * dice que la contraseña era correcta y que falta la segunda prueba.
 */
export type ResultadoAcceso = {
  error?: string;
  segundoPaso?: { email: string; correoTapado: string; tienePasskey: boolean };
};

/** A partir de cuántos fallos seguidos se cierra la puerta, y por cuánto. */
const FALLOS_PARA_CERRAR = 8;
const MINUTOS_CERRADA = 15;

/**
 * Apunta un intento fallido del PERSONAL y, al llegar al tope, cierra la cuenta un rato.
 * Desde el 2026-09-24 esta pantalla comprueba contraseñas de GCC World para quien es
 * cliente de la plataforma: sin freno sería un sitio cómodo donde probarlas.
 */
async function apuntarFallo(id: number, fallosPrevios: number) {
  const fallos = fallosPrevios + 1;
  await prisma.usuario.update({
    where: { id },
    data: {
      intentosFallidos: fallos,
      bloqueadoHasta:
        fallos >= FALLOS_PARA_CERRAR ? new Date(Date.now() + MINUTOS_CERRADA * 60_000) : null,
    },
  });
}

const HASH_FALSO = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';

/**
 * Entrar a un negocio. UNA puerta para las dos clases de cuenta: el personal
 * entra con su usuario (sin «@») y el cliente con su correo. Se distinguen por
 * eso, y así nadie tiene que saber de antemano «cuál soy yo».
 *
 * El mensaje de error es DELIBERADAMENTE el mismo para cuenta inexistente y
 * contraseña incorrecta: distinguirlos revela qué cuentas existen.
 */
export async function entrar(slug: string, datos: FormData): Promise<ResultadoAcceso> {
  const quien = String(datos.get('usuario') || '').trim().toLowerCase();
  const clave = String(datos.get('clave') || '');
  if (!quien || !clave) return { error: 'Escribe tu usuario o correo y tu contraseña.' };

  const inquilino = await prisma.inquilino.findUnique({
    where: { slug },
    include: { suscripcion: true },
  });
  if (!inquilino) return { error: 'Ese negocio no existe.' };

  const abierto = evaluarAcceso(inquilino) === 'ok';

  /**
   * ⚠️ UN CORREO YA NO SIGNIFICA «CLIENTE FINAL» SIN MÁS (2026-09-24).
   *
   * Desde que el personal puede entrar con su correo de GCC World, un «@» dejó de
   * distinguir las dos poblaciones: si no hay ningún cliente final con ese correo, se
   * sigue hacia el personal, donde puede estar como `email`. Antes se devolvía «usuario o
   * contraseña incorrectos» sin mirar siquiera — y el dueño del negocio, que es quien más
   * probabilidades tiene de ser cliente de GCC World, no habría podido entrar nunca.
   */
  const clienteFinal = quien.includes('@')
    ? await prisma.cliente.findUnique({
        where: { inquilinoId_email: { inquilinoId: inquilino.id, email: quien } },
      })
    : null;

  if (clienteFinal) {
    // ── Cliente final
    const cliente = clienteFinal;
    const vale = await bcrypt.compare(clave, cliente.passwordHash ?? HASH_FALSO);
    if (!vale) return { error: 'Usuario o contraseña incorrectos.' };
    // Aquí SÍ se distingue el estado: la contraseña ya fue correcta, así que no
    // se revela nada que el cliente no sepa, y le sirve saber por qué no entra.
    if (cliente.estado === 'PENDIENTE')
      return { error: 'Tu registro todavía está pendiente de aprobación. Te avisaremos cuando esté listo.' };
    if (cliente.estado === 'RECHAZADO') return { error: 'Tu registro no fue aprobado.' };
    if (cliente.estado === 'INACTIVO')
      return { error: 'Tu cuenta está inactiva. Ponte en contacto con el negocio.' };

    if (!inquilino.soloLectura)
      await prisma.cliente.update({ where: { id: cliente.id }, data: { ultimoAcceso: new Date() } });
    await abrirSesionUsuario({
      tipo: 'cliente',
      cid: cliente.id,
      inquilinoId: inquilino.id,
      slug: inquilino.slug,
      nombre: cliente.nombre,
    });
    redirect(abierto ? `/${slug}/mi-servicio` : `/${slug}/suscripcion`);
  }

  // ── Personal (por usuario o por correo)
  const cuenta = await prisma.usuario.findFirst({
    where: { inquilinoId: inquilino.id, OR: [{ usuario: quien }, { email: quien }] },
  });

  // El freno va antes de comprobar nada.
  const cerradaHasta = cuenta?.bloqueadoHasta ?? null;
  if (cerradaHasta && cerradaHasta > new Date()) {
    const minutos = Math.max(1, Math.ceil((cerradaHasta.getTime() - Date.now()) / 60_000));
    return { error: `Demasiados intentos. Vuelve a probar en ${minutos} minuto(s).` };
  }
  const fallosPrevios = cerradaHasta ? 0 : (cuenta?.intentosFallidos ?? 0);

  /**
   * ⭐ ¿ES UN CLIENTE DE GCC WORLD? SE DESCUBRE POR EL CORREO (Fernando, 2026-09-24).
   * Si lo es, manda su contraseña de GCC World y el segundo paso es obligatorio.
   */
  const correo = cuenta?.email || (quien.includes('@') ? quien : null);
  const gcc = cuenta && correo ? await reconocer(correo) : null;

  let vale = false;
  let segundoPaso: ResultadoAcceso['segundoPaso'] | null = null;

  if (cuenta && correo && gcc?.esClienteGcc) {
    const r = await claveGccCorrecta(correo, clave);
    if (r) {
      vale = true;
      // Exenta del segundo paso (el revisor de Meta y similares): la contraseña
      // ya bastó, y un código a un buzón que no es suyo lo dejaría fuera.
      if (!r.sinSegundoPaso)
        segundoPaso = { email: correo, correoTapado: r.correoTapado, tienePasskey: r.tienePasskey };
    }
  } else {
    // Se compara igual aunque la cuenta no exista, para no delatar por el tiempo de
    // respuesta cuáles sí existen.
    vale = await bcrypt.compare(clave, cuenta?.passwordHash ?? HASH_FALSO);
  }

  if (!cuenta || !vale || !cuenta.activo) {
    if (cuenta && !inquilino.soloLectura) await apuntarFallo(cuenta.id, fallosPrevios);
    return { error: 'Usuario o contraseña incorrectos.' };
  }

  // ⚠️ Todavía NO hay sesión: la contraseña era correcta, nada más.
  if (segundoPaso) {
    await abrirPasoDos({
      uid: cuenta.id,
      inquilinoId: inquilino.id,
      slug: inquilino.slug,
      email: segundoPaso.email,
    });
    return { segundoPaso };
  }

  await terminarDeEntrar(inquilino, cuenta);
  // Se mira la mensualidad AQUÍ para ir directo, sin un salto de más por el panel.
  redirect(abierto ? `/${slug}/${INICIO_DE_ROL[cuenta.rol]}` : `/${slug}/suscripcion`);
}

// ── EL SEGUNDO PASO ──────────────────────────────────────────────────────────
//
// Las dos opciones son las MISMAS que en la pantalla de GCC World. ⚠️ Todas empiezan
// leyendo el testigo del primer paso: sin él no se puede entrar solo con un código o una
// passkey, sin haber pasado por la contraseña.

/** Abre la sesión del personal. Solo se llega aquí con los pasos que tocaban hechos. */
async function terminarDeEntrar(
  inquilino: { id: number; slug: string; soloLectura: boolean },
  cuenta: { id: number; nombre: string; rol: RolUsuario },
) {
  // En un escaparate no se escribe NADA, ni siquiera la hora del último acceso.
  if (!inquilino.soloLectura)
    await prisma.usuario.update({
      where: { id: cuenta.id },
      data: { ultimoAcceso: new Date(), intentosFallidos: 0, bloqueadoHasta: null },
    });
  await cerrarPasoDos();
  await abrirSesionUsuario({
    tipo: 'personal',
    uid: cuenta.id,
    inquilinoId: inquilino.id,
    slug: inquilino.slug,
    nombre: cuenta.nombre,
    rol: cuenta.rol,
  });
}

/** Quién pasó el primer paso, junto con su inquilino. */
async function continuar(slug: string) {
  const p = await leerPasoDos();
  if (!p || p.slug !== slug) return null;
  const inquilino = await prisma.inquilino.findUnique({
    where: { id: p.inquilinoId },
    include: { suscripcion: true },
  });
  const cuenta = await prisma.usuario.findFirst({
    where: { id: p.uid, inquilinoId: p.inquilinoId, activo: true },
  });
  if (!inquilino || !cuenta || inquilino.slug !== slug) return null;
  return { p, inquilino, cuenta };
}

/** Pide que le manden el código de seis cifras al correo. */
export async function pedirCodigo(slug: string, clave: string): Promise<ResultadoAcceso> {
  const c = await continuar(slug);
  if (!c) return { error: 'La sesión de acceso caducó. Vuelve a escribir tu contraseña.' };
  const enviado = await enviarCodigo(c.p.email, clave);
  if (!enviado) return { error: 'No se pudo enviar el código. Inténtalo otra vez.' };
  return { segundoPaso: { email: c.p.email, correoTapado: enviado, tienePasskey: false } };
}

/** Segundo paso con el código del correo. */
export async function entrarConCodigo(slug: string, codigo: string): Promise<ResultadoAcceso> {
  const c = await continuar(slug);
  if (!c) return { error: 'La sesión de acceso caducó. Vuelve a escribir tu contraseña.' };
  if (!(await codigoCorrecto(c.p.email, codigo))) {
    if (!c.inquilino.soloLectura) await apuntarFallo(c.cuenta.id, c.cuenta.intentosFallidos);
    return { error: 'Código incorrecto o caducado.' };
  }
  await terminarDeEntrar(c.inquilino, c.cuenta);
  redirect(evaluarAcceso(c.inquilino) === 'ok'
    ? `/${c.inquilino.slug}/${INICIO_DE_ROL[c.cuenta.rol]}`
    : `/${c.inquilino.slug}/suscripcion`);
}

/** Segundo paso con passkey: lo que el navegador necesita para pedirla. */
export async function passkeyOpciones(slug: string, origen: string) {
  const c = await continuar(slug);
  if (!c) return null;
  return passkeyIniciar(c.p.email, origen);
}

/** Segundo paso con passkey: comprobación. */
export async function entrarConPasskey(
  slug: string,
  origen: string,
  credencial: unknown,
): Promise<ResultadoAcceso> {
  const c = await continuar(slug);
  if (!c) return { error: 'La sesión de acceso caducó. Vuelve a escribir tu contraseña.' };
  if (!(await passkeyTerminar(c.p.email, origen, credencial))) {
    if (!c.inquilino.soloLectura) await apuntarFallo(c.cuenta.id, c.cuenta.intentosFallidos);
    return { error: 'No se pudo comprobar la passkey.' };
  }
  await terminarDeEntrar(c.inquilino, c.cuenta);
  redirect(evaluarAcceso(c.inquilino) === 'ok'
    ? `/${c.inquilino.slug}/${INICIO_DE_ROL[c.cuenta.rol]}`
    : `/${c.inquilino.slug}/suscripcion`);
}

export async function salir(slug: string) {
  await cerrarSesion(COOKIE_SESION);
  await cerrarPasoDos();
  redirect(`/${slug}/acceso`);
}

// ── Registro público del cliente final ──────────────────────────────────────

const Registro = z
  .object({
    email: z.string().trim().toLowerCase().email('El correo no es válido.'),
    clave: z.string().min(8, 'La contraseña necesita al menos 8 caracteres.'),
    clave2: z.string(),
    nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
    celular: z.string().trim().regex(/^[0-9]{7,15}$/, 'El celular solo lleva números (7 a 15 dígitos).'),
    direccion: z.string().trim().min(5, 'Escribe tu dirección de entrega.'),
    edificio: z.string().trim().max(120).optional().or(z.literal('')),
    piso: z.string().trim().max(60).optional().or(z.literal('')),
    referencias: z.string().trim().max(300).optional().or(z.literal('')),
    tiposComida: z.array(z.enum(TIPOS_COMIDA as [string, ...string[]])).min(1, 'Elige al menos una comida.'),
  })
  .refine((d) => d.clave === d.clave2, { message: 'Las contraseñas no coinciden.', path: ['clave2'] });

export type ResultadoRegistro = { ok: true } | { ok: false; error: string };

/**
 * Alta pública. El cliente nace PENDIENTE: no entra hasta que el negocio lo
 * aprueba. Es la única escritura sin sesión del producto, así que valida con
 * más celo que ninguna.
 */
export async function registrarse(slug: string, datos: FormData): Promise<ResultadoRegistro> {
  const inquilino = await prisma.inquilino.findUnique({ where: { slug }, include: { suscripcion: true } });
  if (!inquilino) return { ok: false, error: 'Ese negocio no existe.' };
  if (inquilino.soloLectura)
    return { ok: false, error: 'Esto es una demostración: el registro no se guarda. Entra con la cuenta de prueba.' };
  if (!inquilino.registroAbierto)
    return { ok: false, error: 'Este negocio no acepta registros por ahora. Ponte en contacto con ellos.' };
  if (evaluarAcceso(inquilino) !== 'ok')
    return { ok: false, error: 'El registro no está disponible en este momento.' };

  const leido = Registro.safeParse({
    ...Object.fromEntries(datos),
    tiposComida: datos.getAll('tiposComida').map(String),
  });
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  // Solo se aceptan las comidas que el negocio ofrece.
  const comidas = d.tiposComida.filter((t) => (inquilino.tiposComida as string[]).includes(t));
  if (!comidas.length) return { ok: false, error: 'Elige al menos una comida de las que ofrece el negocio.' };

  const repetido = await prisma.cliente.findUnique({
    where: { inquilinoId_email: { inquilinoId: inquilino.id, email: d.email } },
    select: { id: true },
  });
  if (repetido) return { ok: false, error: 'Ya hay un registro con ese correo. Si es tuyo, entra con tu contraseña.' };

  await prisma.cliente.create({
    data: {
      inquilinoId: inquilino.id,
      email: d.email,
      passwordHash: await bcrypt.hash(d.clave, 10),
      nombre: d.nombre,
      celular: d.celular,
      direccion: d.direccion,
      edificio: d.edificio || null,
      piso: d.piso || null,
      referencias: d.referencias || null,
      tiposComida: comidas as never,
      estado: 'PENDIENTE',
    },
  });
  return { ok: true };
}

// ── Operador GCC ────────────────────────────────────────────────────────────

export async function entrarOperador(datos: FormData): Promise<ResultadoAcceso> {
  const email = String(datos.get('email') || '').trim().toLowerCase();
  const clave = String(datos.get('clave') || '');
  if (!email || !clave) return { error: 'Escribe tu correo y tu contraseña.' };

  const op = await prisma.operadorGcc.findUnique({ where: { email } });
  const vale = await bcrypt.compare(clave, op?.passwordHash ?? HASH_FALSO);
  if (!op || !vale || !op.activo) return { error: 'Correo o contraseña incorrectos.' };

  await prisma.operadorGcc.update({ where: { id: op.id }, data: { ultimoAcceso: new Date() } });
  await abrirSesionOperador({ oid: op.id, nombre: op.nombre, email: op.email });
  redirect('/gcc');
}

export async function salirOperador() {
  await cerrarSesion(COOKIE_GCC);
  redirect('/gcc/acceso');
}
