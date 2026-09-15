'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { evaluarAcceso } from '@/lib/inquilino';
import { INICIO_DE_ROL } from '@/lib/permisos';
import { TIPOS_COMIDA } from '@/lib/catalogo';
import {
  abrirSesionUsuario,
  abrirSesionOperador,
  cerrarSesion,
  COOKIE_GCC,
  COOKIE_SESION,
} from '@/lib/sesion';

export type ResultadoAcceso = { error?: string };

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

  if (quien.includes('@')) {
    // ── Cliente final
    const cliente = await prisma.cliente.findUnique({
      where: { inquilinoId_email: { inquilinoId: inquilino.id, email: quien } },
    });
    const vale = await bcrypt.compare(clave, cliente?.passwordHash ?? HASH_FALSO);
    if (!cliente || !vale) return { error: 'Usuario o contraseña incorrectos.' };
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

  // ── Personal
  const cuenta = await prisma.usuario.findUnique({
    where: { inquilinoId_usuario: { inquilinoId: inquilino.id, usuario: quien } },
  });
  // Se compara igual aunque la cuenta no exista, para no delatar por el tiempo de
  // respuesta cuáles sí existen.
  const vale = await bcrypt.compare(clave, cuenta?.passwordHash ?? HASH_FALSO);
  if (!cuenta || !vale || !cuenta.activo) return { error: 'Usuario o contraseña incorrectos.' };

  // En un escaparate no se escribe NADA, ni siquiera la hora del último acceso.
  if (!inquilino.soloLectura)
    await prisma.usuario.update({ where: { id: cuenta.id }, data: { ultimoAcceso: new Date() } });
  await abrirSesionUsuario({
    tipo: 'personal',
    uid: cuenta.id,
    inquilinoId: inquilino.id,
    slug: inquilino.slug,
    nombre: cuenta.nombre,
    rol: cuenta.rol,
  });
  // Se mira la mensualidad AQUÍ para ir directo, sin un salto de más por el panel.
  redirect(abierto ? `/${slug}/${INICIO_DE_ROL[cuenta.rol]}` : `/${slug}/suscripcion`);
}

export async function salir(slug: string) {
  await cerrarSesion(COOKIE_SESION);
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
