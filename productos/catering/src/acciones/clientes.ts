'use server';

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura, contextoEscrituraCliente } from '@/lib/inquilino';
import { TIPOS_COMIDA, DIAS_SEMANA } from '@/lib/catalogo';
import { enviarCorreo, correoBienvenida, correoSolicitudInfo, correoRechazo } from '@/lib/correo';
import type { Genero, Actividad, DiaSemana, TipoComida } from '@/generated/prisma/enums';

export type ResultadoCliente = { ok: true; id?: number; clave?: string } | { ok: false; error: string };

const claveAlAzar = () => randomBytes(9).toString('base64url');
const opcional = (max = 200) => z.string().trim().max(max).optional().or(z.literal(''));
const numeroOpcional = (min: number, max: number) =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().min(min).max(max).optional());
const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'El color tiene que ser un hexadecimal como #C42B1C.').optional().or(z.literal(''));

/** Los datos que edita el personal. El correo y la contraseña van aparte. */
const Ficha = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del cliente.').max(120),
  celular: z.string().trim().regex(/^[0-9]{7,15}$/, 'El celular solo lleva números (7 a 15 dígitos).'),
  edad: numeroOpcional(1, 120),
  facebook: opcional(120),
  instagram: opcional(120),
  tiktok: opcional(120),
  altura: numeroOpcional(0.5, 2.5),
  peso: numeroOpcional(20, 300),
  genero: z.enum(['MASCULINO', 'FEMENINO', 'OTRO']).optional().or(z.literal('')),
  frecuenciaActividad: z.enum(['SEDENTARIO', 'LEVE', 'MODERADO', 'INTENSO']).optional().or(z.literal('')),
  direccion: z.string().trim().min(5, 'Escribe la dirección de entrega.').max(300),
  edificio: opcional(120),
  piso: opcional(60),
  referencias: opcional(300),
  colorIdentificador: hex,
  direccion2: opcional(300),
  edificio2: opcional(120),
  piso2: opcional(60),
  referencias2: opcional(300),
  colorIdentificador2: hex,
  sinAgua: z.boolean(),
  sinFruta: z.boolean(),
  sinCubiertos: z.boolean(),
  envasesPropios: z.boolean(),
});

type DatosFicha = {
  nombre: string; celular: string; edad: number | null;
  facebook: string | null; instagram: string | null; tiktok: string | null;
  altura: number | null; peso: number | null; genero: Genero | null; frecuenciaActividad: Actividad | null;
  direccion: string; edificio: string | null; piso: string | null; referencias: string | null; colorIdentificador: string | null;
  direccion2: string | null; edificio2: string | null; piso2: string | null; referencias2: string | null; colorIdentificador2: string | null;
  diasDireccion2: DiaSemana[]; tiposComida: TipoComida[];
  sinAgua: boolean; sinFruta: boolean; sinCubiertos: boolean; envasesPropios: boolean;
};

/** FormData → objeto de la ficha, con las casillas y las listas bien leídas. */
function leerFicha(datos: FormData): { error: string; datos?: never } | { error?: never; datos: DatosFicha } {
  const o = Object.fromEntries(datos) as Record<string, unknown>;
  for (const k of ['sinAgua', 'sinFruta', 'sinCubiertos', 'envasesPropios'])
    o[k] = datos.get(k) === 'on' || datos.get(k) === 'true';
  const leido = Ficha.safeParse(o);
  if (!leido.success) return { error: leido.error.issues[0].message };
  const d = leido.data;
  const diasDireccion2 = datos.getAll('diasDireccion2').map(String).filter((x) => (DIAS_SEMANA as string[]).includes(x));
  const tiposComida = datos.getAll('tiposComida').map(String).filter((x) => (TIPOS_COMIDA as string[]).includes(x));
  if (d.direccion2 && d.direccion2.length < 5)
    return { error: 'La segunda dirección necesita al menos 5 caracteres (o déjala vacía).' };
  return {
    datos: {
      nombre: d.nombre,
      celular: d.celular,
      edad: d.edad ?? null,
      facebook: d.facebook || null,
      instagram: d.instagram || null,
      tiktok: d.tiktok || null,
      altura: d.altura ?? null,
      peso: d.peso ?? null,
      genero: (d.genero || null) as Genero | null,
      frecuenciaActividad: (d.frecuenciaActividad || null) as Actividad | null,
      direccion: d.direccion,
      edificio: d.edificio || null,
      piso: d.piso || null,
      referencias: d.referencias || null,
      colorIdentificador: d.colorIdentificador ? d.colorIdentificador.toUpperCase() : null,
      direccion2: d.direccion2 || null,
      edificio2: d.direccion2 ? d.edificio2 || null : null,
      piso2: d.direccion2 ? d.piso2 || null : null,
      referencias2: d.direccion2 ? d.referencias2 || null : null,
      colorIdentificador2: d.direccion2 && d.colorIdentificador2 ? d.colorIdentificador2.toUpperCase() : null,
      diasDireccion2: (d.direccion2 ? diasDireccion2 : []) as DiaSemana[],
      tiposComida: tiposComida as TipoComida[],
      sinAgua: d.sinAgua,
      sinFruta: d.sinFruta,
      sinCubiertos: d.sinCubiertos,
      envasesPropios: d.envasesPropios,
    },
  };
}

// ── Personal ────────────────────────────────────────────────────────────────

/** Alta a mano por el personal: nace ACTIVO, con contraseña generada que se enseña UNA vez. */
export async function crearCliente(slug: string, datos: FormData): Promise<ResultadoCliente> {
  const permiso = await contextoEscritura(slug, 'clientes');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const email = String(datos.get('email') || '').trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { ok: false, error: 'El correo no es válido.' };
  const ficha = leerFicha(datos);
  if (ficha.error !== undefined) return { ok: false, error: ficha.error };

  const repetido = await prisma.cliente.findUnique({
    where: { inquilinoId_email: { inquilinoId: ctx.inquilino.id, email } },
    select: { id: true },
  });
  if (repetido) return { ok: false, error: `Ya hay un cliente con el correo «${email}».` };

  const clave = String(datos.get('clave') || '') || claveAlAzar();
  if (clave.length < 8) return { ok: false, error: 'La contraseña necesita al menos 8 caracteres.' };

  const c = await prisma.cliente.create({
    data: {
      inquilinoId: ctx.inquilino.id,
      email,
      passwordHash: await bcrypt.hash(clave, 10),
      estado: 'ACTIVO',
      ...ficha.datos,
    },
  });
  revalidatePath(`/${slug}/clientes`);
  return { ok: true, id: c.id, clave: datos.get('clave') ? undefined : clave };
}

export async function editarCliente(slug: string, id: number, datos: FormData): Promise<ResultadoCliente> {
  const permiso = await contextoEscritura(slug, 'clientes');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const cliente = await prisma.cliente.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
  if (!cliente) return { ok: false, error: 'El cliente no existe.' };

  const ficha = leerFicha(datos);
  if (ficha.error !== undefined) return { ok: false, error: ficha.error };

  const email = String(datos.get('email') || '').trim().toLowerCase();
  if (email) {
    if (!z.string().email().safeParse(email).success) return { ok: false, error: 'El correo no es válido.' };
    const otro = await prisma.cliente.findFirst({
      where: { inquilinoId: ctx.inquilino.id, email, id: { not: id } },
      select: { id: true },
    });
    if (otro) return { ok: false, error: `Ya hay otro cliente con el correo «${email}».` };
  }

  // Los motorizados los elige el personal, no el cliente: van en este formulario.
  const motorizadoId = Number(datos.get('motorizadoId') || 0) || null;
  const motorizado2Id = Number(datos.get('motorizado2Id') || 0) || null;
  for (const m of [motorizadoId, motorizado2Id]) {
    if (m && !(await prisma.motorizado.findFirst({ where: { id: m, inquilinoId: ctx.inquilino.id }, select: { id: true } })))
      return { ok: false, error: 'Ese motorizado no existe.' };
  }

  await prisma.cliente.update({
    where: { id },
    data: { ...ficha.datos, ...(email ? { email } : {}), motorizadoId, motorizado2Id: ficha.datos.direccion2 ? motorizado2Id : null },
  });
  revalidatePath(`/${slug}/clientes`);
  revalidatePath(`/${slug}/clientes/${id}`);
  return { ok: true };
}

const CAMBIOS = ['APROBAR', 'RECHAZAR', 'SOLICITAR_INFO', 'ACTIVAR', 'INACTIVAR'] as const;
export type CambioEstado = (typeof CAMBIOS)[number];

/**
 * El paso de estado del cliente, con su mensaje. Aprobar y rechazar solo valen
 * desde PENDIENTE; activar/inactivar, desde los dos estados de un cliente ya
 * aceptado. Cada cambio deja un mensaje en el portal y, si hay correo, lo manda.
 */
export async function cambiarEstadoCliente(
  slug: string,
  id: number,
  cambio: CambioEstado,
  mensaje: string,
): Promise<ResultadoCliente> {
  const permiso = await contextoEscritura(slug, 'clientes');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  if (!CAMBIOS.includes(cambio)) return { ok: false, error: 'Cambio desconocido.' };

  const cliente = await prisma.cliente.findFirst({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!cliente) return { ok: false, error: 'El cliente no existe.' };
  const texto = mensaje.trim();

  const transiciones: Record<CambioEstado, { desde: string[]; a: 'ACTIVO' | 'RECHAZADO' | 'PENDIENTE' | 'INACTIVO'; tipo: 'APROBACION' | 'RECHAZO' | 'SOLICITUD_INFO' | 'NOTIFICACION'; requiereTexto: boolean }> = {
    APROBAR: { desde: ['PENDIENTE'], a: 'ACTIVO', tipo: 'APROBACION', requiereTexto: false },
    RECHAZAR: { desde: ['PENDIENTE'], a: 'RECHAZADO', tipo: 'RECHAZO', requiereTexto: false },
    SOLICITAR_INFO: { desde: ['PENDIENTE'], a: 'PENDIENTE', tipo: 'SOLICITUD_INFO', requiereTexto: true },
    ACTIVAR: { desde: ['INACTIVO', 'RECHAZADO'], a: 'ACTIVO', tipo: 'NOTIFICACION', requiereTexto: false },
    INACTIVAR: { desde: ['ACTIVO'], a: 'INACTIVO', tipo: 'NOTIFICACION', requiereTexto: false },
  };
  const t = transiciones[cambio];
  if (!t.desde.includes(cliente.estado))
    return { ok: false, error: `No se puede «${cambio.toLowerCase().replace('_', ' ')}» a un cliente ${cliente.estado.toLowerCase()}.` };
  if (t.requiereTexto && !texto) return { ok: false, error: 'Escribe qué información necesitas.' };

  await prisma.$transaction([
    prisma.cliente.update({ where: { id }, data: { estado: t.a } }),
    ...(texto || cambio === 'APROBAR'
      ? [
          prisma.mensaje.create({
            data: {
              inquilinoId: ctx.inquilino.id,
              clienteId: id,
              tipo: t.tipo,
              texto: texto || 'Tu registro fue aprobado. ¡Bienvenido/a!',
            },
          }),
        ]
      : []),
  ]);

  // El correo es un aviso: si falla o no está configurado, el mensaje ya quedó en el portal.
  const urlAcceso = `${process.env.APP_URL || ''}/${slug}/acceso`;
  const negocio = ctx.inquilino.nombre;
  const c =
    cambio === 'APROBAR'
      ? correoBienvenida(negocio, cliente.nombre, urlAcceso)
      : cambio === 'SOLICITAR_INFO'
        ? correoSolicitudInfo(negocio, cliente.nombre, texto, urlAcceso)
        : cambio === 'RECHAZAR'
          ? correoRechazo(negocio, cliente.nombre, texto || null)
          : null;
  if (c) void enviarCorreo(cliente.email, c.asunto, c.html);

  revalidatePath(`/${slug}/clientes`);
  revalidatePath(`/${slug}/clientes/${id}`);
  return { ok: true };
}

export async function enviarMensaje(slug: string, id: number, texto: string): Promise<ResultadoCliente> {
  const permiso = await contextoEscritura(slug, 'clientes');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const t = texto.trim();
  if (!t) return { ok: false, error: 'Escribe el mensaje.' };
  const cliente = await prisma.cliente.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
  if (!cliente) return { ok: false, error: 'El cliente no existe.' };
  await prisma.mensaje.create({ data: { inquilinoId: ctx.inquilino.id, clienteId: id, texto: t, tipo: 'NOTIFICACION' } });
  revalidatePath(`/${slug}/clientes/${id}`);
  return { ok: true };
}

/** Las restricciones de cocina del cliente: alimento → comidas a las que aplica ([] = todas). */
export async function guardarRestricciones(
  slug: string,
  id: number,
  restricciones: { alimentoId: number; tiposComida: string[] }[],
): Promise<ResultadoCliente> {
  const permiso = await contextoEscritura(slug, 'clientes');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const cliente = await prisma.cliente.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
  if (!cliente) return { ok: false, error: 'El cliente no existe.' };
  return guardarRestriccionesDe(ctx.inquilino.id, id, restricciones, () => revalidatePath(`/${slug}/clientes/${id}`));
}

async function guardarRestriccionesDe(
  inquilinoId: number,
  clienteId: number,
  restricciones: { alimentoId: number; tiposComida: string[] }[],
  despues: () => void,
): Promise<ResultadoCliente> {
  const ids = [...new Set(restricciones.map((r) => Number(r.alimentoId)).filter(Boolean))];
  const validos = await prisma.alimento.findMany({ where: { id: { in: ids }, inquilinoId }, select: { id: true } });
  if (validos.length !== ids.length) return { ok: false, error: 'Alguno de los alimentos no es de este negocio.' };

  await prisma.$transaction([
    prisma.clienteRestriccion.deleteMany({ where: { clienteId } }),
    ...ids.map((alimentoId) =>
      prisma.clienteRestriccion.create({
        data: {
          clienteId,
          alimentoId,
          tiposComida: (restricciones.find((r) => Number(r.alimentoId) === alimentoId)?.tiposComida ?? [])
            .filter((t) => (TIPOS_COMIDA as string[]).includes(t)) as never,
        },
      }),
    ),
  ]);
  despues();
  return { ok: true };
}

export async function restablecerClaveCliente(slug: string, id: number): Promise<ResultadoCliente> {
  const permiso = await contextoEscritura(slug, 'clientes');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const cliente = await prisma.cliente.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
  if (!cliente) return { ok: false, error: 'El cliente no existe.' };
  const clave = claveAlAzar();
  await prisma.cliente.update({ where: { id }, data: { passwordHash: await bcrypt.hash(clave, 10) } });
  return { ok: true, clave };
}

// ── Portal del cliente ──────────────────────────────────────────────────────

/** El cliente edita su ficha. Los motorizados y el estado NO: eso es del negocio. */
export async function editarMiPerfil(slug: string, datos: FormData): Promise<ResultadoCliente> {
  const permiso = await contextoEscrituraCliente(slug);
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const ficha = leerFicha(datos);
  if (ficha.error !== undefined) return { ok: false, error: ficha.error };
  // Si quita la segunda dirección, el segundo motorizado deja de tener sentido.
  await prisma.cliente.update({
    where: { id: ctx.cliente.id },
    data: { ...ficha.datos, ...(ficha.datos.direccion2 ? {} : { motorizado2Id: null }) },
  });
  revalidatePath(`/${slug}/mi-perfil`);
  revalidatePath(`/${slug}/mi-direccion`);
  return { ok: true };
}

export async function guardarMisRestricciones(
  slug: string,
  restricciones: { alimentoId: number; tiposComida: string[] }[],
): Promise<ResultadoCliente> {
  const permiso = await contextoEscrituraCliente(slug);
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  return guardarRestriccionesDe(ctx.inquilino.id, ctx.cliente.id, restricciones, () => revalidatePath(`/${slug}/mi-perfil`));
}

export async function cambiarMiClaveCliente(slug: string, datos: FormData): Promise<ResultadoCliente> {
  const permiso = await contextoEscrituraCliente(slug);
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const actual = String(datos.get('actual') || '');
  const nueva = String(datos.get('nueva') || '');
  if (nueva.length < 8) return { ok: false, error: 'La nueva contraseña necesita al menos 8 caracteres.' };
  if (!(await bcrypt.compare(actual, ctx.cliente.passwordHash)))
    return { ok: false, error: 'La contraseña actual no es correcta.' };
  await prisma.cliente.update({ where: { id: ctx.cliente.id }, data: { passwordHash: await bcrypt.hash(nueva, 10) } });
  return { ok: true };
}

export async function marcarMensajesLeidos(slug: string): Promise<ResultadoCliente> {
  const permiso = await contextoEscrituraCliente(slug);
  if (!permiso.ok) return { ok: false, error: permiso.error };
  await prisma.mensaje.updateMany({ where: { clienteId: permiso.ctx.cliente.id, leido: false }, data: { leido: true } });
  revalidatePath(`/${slug}/mi-servicio`);
  return { ok: true };
}
