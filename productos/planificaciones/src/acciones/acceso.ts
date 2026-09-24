'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { evaluarAcceso } from '@/lib/inquilino';
import { INICIO_DE_ROL } from '@/lib/permisos';
import type { RolUsuario } from '@/generated/prisma/enums';
import {
  reconocer, claveGccCorrecta, enviarCodigo, codigoCorrecto,
  passkeyIniciar, passkeyTerminar,
} from '@/lib/identidadGcc';
import {
  abrirSesionUsuario, abrirSesionOperador, cerrarSesion,
  abrirPasoDos, leerPasoDos, cerrarPasoDos, COOKIE_GCC, COOKIE_SESION,
} from '@/lib/sesion';

export type ResultadoAcceso = {
  error?: string;
  segundoPaso?: { email: string; correoTapado: string; tienePasskey: boolean };
};

const HASH_FALSO = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';

/** A partir de cuántos fallos seguidos se cierra la puerta, y por cuánto. */
const FALLOS_PARA_CERRAR = 8;
const MINUTOS_CERRADA = 15;

/**
 * Apunta un intento fallido y, al llegar al tope, cierra la cuenta un rato.
 *
 * Ocho intentos son de sobra para quien se equivoca y ridículamente pocos para quien las
 * prueba a máquina. Desde que esta pantalla comprueba contraseñas de GCC World (para
 * quien es cliente de la plataforma), sin freno sería un sitio cómodo donde probarlas.
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

/**
 * ENTRAR. Una pantalla, y hasta dos pasos.
 *
 * ── EL SEGUNDO PASO, PARA LOS CLIENTES DE GCC WORLD (Fernando, 2026-09-24) ──────
 * Se mira el CORREO de la cuenta y se le pregunta a la plataforma si es el de un cliente
 * de GCC World. Si lo es, manda **su contraseña de GCC World** —«siendo una sola
 * contraseña su acceso»— y se le exige el mismo segundo paso que allí: passkey o código
 * al correo.
 *
 * ⚠️ Nadie marca esto en ningún formulario: se **descubre** por el correo. Dejar que un
 * cliente declarara que una cuenta es «de GCC World» sería darle dónde probar contraseñas
 * de la plataforma (es el agujero que se cerró en automatizaciones esa misma mañana).
 *
 * Quien no es cliente de GCC World entra como siempre, de una vez, con la contraseña que
 * le dio su administrador.
 *
 * El mensaje de error es DELIBERADAMENTE el mismo para cuenta inexistente y contraseña
 * incorrecta: distinguirlos revela qué cuentas existen.
 */
export async function entrar(slug: string, datos: FormData): Promise<ResultadoAcceso> {
  const escrito = String(datos.get('usuario') || '').trim().toLowerCase();
  const clave = String(datos.get('clave') || '');
  if (!escrito || !clave) return { error: 'Escribe tu usuario y tu contraseña.' };

  const inquilino = await prisma.inquilino.findUnique({
    where: { slug },
    include: { suscripcion: true },
  });
  if (!inquilino) return { error: 'Esa institución no existe.' };

  // Por usuario O por correo: quien es cliente de GCC World escribe su correo, y su
  // cuenta de aquí puede tener otro nombre de usuario.
  const cuenta = await prisma.usuario.findFirst({
    where: { inquilinoId: inquilino.id, OR: [{ usuario: escrito }, { email: escrito }] },
  });

  // El freno va antes de comprobar nada.
  const cerradaHasta = cuenta?.bloqueadoHasta ?? null;
  if (cerradaHasta && cerradaHasta > new Date()) {
    const minutos = Math.max(1, Math.ceil((cerradaHasta.getTime() - Date.now()) / 60_000));
    return { error: `Demasiados intentos. Vuelve a probar en ${minutos} minuto(s).` };
  }
  // Cumplido el castigo se empieza de cero; si no, el primer error de quien ya esperó
  // sus 15 minutos le costaría otros 15.
  const fallosPrevios = cerradaHasta ? 0 : (cuenta?.intentosFallidos ?? 0);

  const correo = cuenta?.email || (escrito.includes('@') ? escrito : null);
  const gcc = cuenta && correo ? await reconocer(correo) : null;

  let vale = false;
  let segundoPaso: ResultadoAcceso['segundoPaso'] | null = null;

  if (cuenta && correo && gcc?.esClienteGcc) {
    const r = await claveGccCorrecta(correo, clave);
    if (r) {
      vale = true;
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
  redirect(evaluarAcceso(inquilino) === 'ok' ? `/${inquilino.slug}/${INICIO_DE_ROL[cuenta.rol]}` : `/${inquilino.slug}/suscripcion`);
}

// ── EL SEGUNDO PASO ──────────────────────────────────────────────────────────
//
// Las dos opciones son las MISMAS que en la pantalla de GCC World, y a propósito: quien
// ya entra a la plataforma no tiene que aprender nada nuevo para entrar a un producto.
//
// ⚠️ Todas empiezan leyendo el testigo del primer paso. Sin él no hay nada que completar
// —y sobre todo, no se puede entrar solo con un código o una passkey sin haber pasado
// por la contraseña—.

/** Abre la sesión de verdad. Solo se llega aquí con los pasos que tocaban hechos. */
async function terminarDeEntrar(
  inquilino: { id: number; slug: string; soloLectura: boolean },
  cuenta: { id: number; nombre: string; rol: RolUsuario },
) {
  // En un escaparate no se escribe NADA, ni siquiera la hora del último acceso: con
  // visitantes entrando a diario, esa columna sería lo único que cambiaría.
  if (!inquilino.soloLectura)
    await prisma.usuario.update({
      where: { id: cuenta.id },
      data: { ultimoAcceso: new Date(), intentosFallidos: 0, bloqueadoHasta: null },
    });
  await cerrarPasoDos();
  await abrirSesionUsuario({
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
  // Se vuelve a exigir la contraseña: así el testigo por sí solo no sirve para llenarle
  // el buzón a nadie.
  const enviado = await enviarCodigo(c.p.email, clave);
  if (!enviado) return { error: 'No se pudo enviar el código. Inténtalo otra vez.' };
  return { segundoPaso: { email: c.p.email, correoTapado: enviado, tienePasskey: false } };
}

/** Segundo paso con el código del correo. */
export async function entrarConCodigo(slug: string, codigo: string): Promise<ResultadoAcceso> {
  const c = await continuar(slug);
  if (!c) return { error: 'La sesión de acceso caducó. Vuelve a escribir tu contraseña.' };
  if (!(await codigoCorrecto(c.p.email, codigo))) {
    // Un código equivocado cuenta como intento: si no, el segundo paso sería el único
    // sitio del acceso sin freno, y es de seis cifras.
    if (!c.inquilino.soloLectura) await apuntarFallo(c.cuenta.id, c.cuenta.intentosFallidos);
    return { error: 'Código incorrecto o caducado.' };
  }
  await terminarDeEntrar(c.inquilino, c.cuenta);
  redirect(evaluarAcceso(c.inquilino) === 'ok' ? `/${c.inquilino.slug}/${INICIO_DE_ROL[c.cuenta.rol]}` : `/${c.inquilino.slug}/suscripcion`);
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
  redirect(evaluarAcceso(c.inquilino) === 'ok' ? `/${c.inquilino.slug}/${INICIO_DE_ROL[c.cuenta.rol]}` : `/${c.inquilino.slug}/suscripcion`);
}

export async function salir(slug: string) {
  await cerrarSesion(COOKIE_SESION);
  await cerrarPasoDos();
  redirect(`/${slug}/acceso`);
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
