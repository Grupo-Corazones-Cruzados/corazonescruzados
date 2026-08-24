'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoApi } from '@/lib/inquilino';
import { VIVAS } from '@/lib/reservas';

export type Resultado = { ok: true; id: number } | { ok: false; error: string };

const Entrada = z.object({
  suiteId: z.coerce.number().int().positive(),
  clienteNombre: z.string().trim().min(2, 'Escribe el nombre del huésped.'),
  telefono: z.string().trim().max(30).optional().or(z.literal('')),
  documento: z.string().trim().max(30).optional().or(z.literal('')),
  entrada: z.string().min(1, 'Falta la fecha de entrada.'),
  salida: z.string().min(1, 'Falta la fecha de salida.'),
  precioTotal: z.coerce.number().min(0).default(0),
  anticipo: z.coerce.number().min(0).default(0),
  estadoPago: z.enum(['PENDIENTE', 'PAGADO']).default('PENDIENTE'),
  estado: z.enum(['OCUPADA', 'POR_SALIR', 'FINALIZADA']).default('OCUPADA'),
  comentarios: z.string().trim().max(2000).optional().or(z.literal('')),
});

function leer(datos: FormData) {
  return Entrada.safeParse(Object.fromEntries(datos));
}

/**
 * DOS ESTANCIAS NO PUEDEN SOLAPARSE EN LA MISMA SUITE. Se comprueba en el
 * servidor, contra la base, en el momento de guardar: una comprobación hecha solo
 * en el formulario se salta abriendo dos pestañas.
 *
 * Se solapan cuando una empieza antes de que la otra acabe y acaba después de que
 * la otra empiece. Tocarse en el extremo NO es solaparse: quien sale a las 12:00
 * deja la suite libre para quien entra a las 12:00.
 */
async function haySolape(
  inquilinoId: number,
  suiteId: number,
  entrada: Date,
  salida: Date,
  excluirId?: number,
) {
  return prisma.reserva.findFirst({
    where: {
      inquilinoId,
      suiteId,
      estado: { in: VIVAS },
      id: excluirId ? { not: excluirId } : undefined,
      entrada: { lt: salida },
      salida: { gt: entrada },
    },
    select: { id: true, clienteNombre: true, entrada: true, salida: true },
  });
}

type Fechas = { ok: true; entrada: Date; salida: Date } | { ok: false; error: string };

function validarFechas(entradaTxt: string, salidaTxt: string): Fechas {
  const entrada = new Date(entradaTxt);
  const salida = new Date(salidaTxt);
  if (Number.isNaN(entrada.getTime()) || Number.isNaN(salida.getTime()))
    return { ok: false, error: 'Las fechas no son válidas.' };
  if (salida <= entrada) return { ok: false, error: 'La salida tiene que ser posterior a la entrada.' };
  return { ok: true, entrada, salida };
}

export async function crearReserva(slug: string, datos: FormData): Promise<Resultado> {
  const ctx = await contextoApi(slug, 'GERENTE');
  if (!ctx) return { ok: false, error: 'No tienes permiso para crear reservas.' };

  const leido = leer(datos);
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  const f = validarFechas(d.entrada, d.salida);
  if (!f.ok) return { ok: false, error: f.error };

  // La suite tiene que ser de ESTE hotel. Sin esta comprobación, un identificador
  // cambiado a mano metería una reserva en el hotel de al lado.
  const suite = await prisma.suite.findFirst({
    where: { id: d.suiteId, inquilinoId: ctx.inquilino.id },
    select: { id: true },
  });
  if (!suite) return { ok: false, error: 'Esa suite no existe en este alojamiento.' };

  const choque = await haySolape(ctx.inquilino.id, d.suiteId, f.entrada, f.salida);
  if (choque)
    return {
      ok: false,
      error: `Esa suite ya está reservada para ${choque.clienteNombre} en esas fechas.`,
    };

  const creada = await prisma.reserva.create({
    data: {
      inquilinoId: ctx.inquilino.id,
      suiteId: d.suiteId,
      clienteNombre: d.clienteNombre,
      telefono: d.telefono || null,
      documento: d.documento || null,
      entrada: f.entrada,
      salida: f.salida,
      precioTotal: d.precioTotal,
      anticipo: d.anticipo,
      estadoPago: d.estadoPago,
      estado: d.estado,
      comentarios: d.comentarios || null,
      creadoPor: ctx.sesion.nombre,
    },
    select: { id: true },
  });

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, id: creada.id };
}

export async function actualizarReserva(
  slug: string,
  id: number,
  datos: FormData,
): Promise<Resultado> {
  const ctx = await contextoApi(slug, 'GERENTE');
  if (!ctx) return { ok: false, error: 'No tienes permiso para editar reservas.' };

  const existente = await prisma.reserva.findFirst({
    where: { id, inquilinoId: ctx.inquilino.id },
    select: { id: true },
  });
  if (!existente) return { ok: false, error: 'La reserva no existe.' };

  const leido = leer(datos);
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  const f = validarFechas(d.entrada, d.salida);
  if (!f.ok) return { ok: false, error: f.error };

  const suite = await prisma.suite.findFirst({
    where: { id: d.suiteId, inquilinoId: ctx.inquilino.id },
    select: { id: true },
  });
  if (!suite) return { ok: false, error: 'Esa suite no existe en este alojamiento.' };

  const choque = await haySolape(ctx.inquilino.id, d.suiteId, f.entrada, f.salida, id);
  if (choque)
    return {
      ok: false,
      error: `Esa suite ya está reservada para ${choque.clienteNombre} en esas fechas.`,
    };

  await prisma.reserva.update({
    where: { id },
    data: {
      suiteId: d.suiteId,
      clienteNombre: d.clienteNombre,
      telefono: d.telefono || null,
      documento: d.documento || null,
      entrada: f.entrada,
      salida: f.salida,
      precioTotal: d.precioTotal,
      anticipo: d.anticipo,
      estadoPago: d.estadoPago,
      estado: d.estado,
      comentarios: d.comentarios || null,
    },
  });

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, id };
}

/**
 * Eliminar NO borra la fila: la marca. Un reporte del mes pasado no puede cambiar
 * porque hoy alguien limpie una reserva.
 */
export async function eliminarReserva(slug: string, id: number): Promise<Resultado> {
  const ctx = await contextoApi(slug, 'GERENTE');
  if (!ctx) return { ok: false, error: 'No tienes permiso para eliminar reservas.' };

  const r = await prisma.reserva.updateMany({
    where: { id, inquilinoId: ctx.inquilino.id },
    data: { estado: 'ELIMINADA' },
  });
  if (!r.count) return { ok: false, error: 'La reserva no existe.' };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, id };
}

/** Atajos del detalle: registrar el cobro y dar la salida. */
export async function marcarPagada(slug: string, id: number): Promise<Resultado> {
  const ctx = await contextoApi(slug, 'GERENTE');
  if (!ctx) return { ok: false, error: 'No tienes permiso.' };
  const r = await prisma.reserva.findFirst({
    where: { id, inquilinoId: ctx.inquilino.id },
    select: { precioTotal: true },
  });
  if (!r) return { ok: false, error: 'La reserva no existe.' };
  await prisma.reserva.update({
    where: { id },
    data: { estadoPago: 'PAGADO', anticipo: r.precioTotal },
  });
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, id };
}

export async function darSalida(slug: string, id: number): Promise<Resultado> {
  const ctx = await contextoApi(slug, 'GERENTE');
  if (!ctx) return { ok: false, error: 'No tienes permiso.' };
  const r = await prisma.reserva.updateMany({
    where: { id, inquilinoId: ctx.inquilino.id },
    data: { estado: 'FINALIZADA' },
  });
  if (!r.count) return { ok: false, error: 'La reserva no existe.' };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, id };
}
