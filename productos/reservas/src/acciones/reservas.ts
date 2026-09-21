'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { VIVAS, estadoPagoDe } from '@/lib/reservas';
import { desdeCampoFechaHora } from '@/lib/fechas';

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
  // Ni `estadoPago` ni `estado` llegan del formulario (Fernando, 2026-09-20): el
  // pago se deriva de lo pagado frente al precio, y el estado solo lo mueven los
  // botones del detalle.
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

/**
 * Las horas del formulario son las del reloj del HOTEL, no las del servidor: un
 * `new Date('2026-09-20T14:00')` aquí sería las 14:00 UTC, cinco horas antes de
 * lo que el recepcionista escribió.
 */
function validarFechas(entradaTxt: string, salidaTxt: string, zonaHoraria: string): Fechas {
  const entrada = desdeCampoFechaHora(entradaTxt, zonaHoraria);
  const salida = desdeCampoFechaHora(salidaTxt, zonaHoraria);
  if (!entrada || !salida) return { ok: false, error: 'Las fechas no son válidas.' };
  if (salida <= entrada) return { ok: false, error: 'La salida tiene que ser posterior a la entrada.' };
  return { ok: true, entrada, salida };
}

function validarCuenta(precioTotal: number, anticipo: number) {
  if (anticipo > precioTotal) return 'El valor pagado no puede superar el precio total.';
  return null;
}

export async function crearReserva(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'GERENTE');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = leer(datos);
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  const f = validarFechas(d.entrada, d.salida, ctx.inquilino.zonaHoraria);
  if (!f.ok) return { ok: false, error: f.error };
  const malaCuenta = validarCuenta(d.precioTotal, d.anticipo);
  if (malaCuenta) return { ok: false, error: malaCuenta };

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
      estadoPago: estadoPagoDe(d.precioTotal, d.anticipo),
      estado: 'OCUPADA',
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
  const permiso = await contextoEscritura(slug, 'GERENTE');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const existente = await prisma.reserva.findFirst({
    where: { id, inquilinoId: ctx.inquilino.id },
    select: { id: true },
  });
  if (!existente) return { ok: false, error: 'La reserva no existe.' };

  const leido = leer(datos);
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  const f = validarFechas(d.entrada, d.salida, ctx.inquilino.zonaHoraria);
  if (!f.ok) return { ok: false, error: f.error };
  const malaCuenta = validarCuenta(d.precioTotal, d.anticipo);
  if (malaCuenta) return { ok: false, error: malaCuenta };

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
      estadoPago: estadoPagoDe(d.precioTotal, d.anticipo),
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
  const permiso = await contextoEscritura(slug, 'GERENTE');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const r = await prisma.reserva.updateMany({
    where: { id, inquilinoId: ctx.inquilino.id },
    data: { estado: 'ELIMINADA' },
  });
  if (!r.count) return { ok: false, error: 'La reserva no existe.' };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, id };
}

/**
 * Dar la salida. Solo con la cuenta saldada (Fernando, 2026-09-20): «Marcar como
 * pagada» desapareció porque el pago se deriva de lo pagado, así que para cerrar
 * una estancia con saldo hay que editar la reserva y anotar el cobro.
 */
export async function darSalida(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'GERENTE');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const r = await prisma.reserva.findFirst({
    where: { id, inquilinoId: ctx.inquilino.id },
    select: { estadoPago: true, estado: true },
  });
  if (!r) return { ok: false, error: 'La reserva no existe.' };
  if (r.estadoPago !== 'PAGADO')
    return { ok: false, error: 'La reserva tiene saldo pendiente: anota el pago completo antes de dar la salida.' };
  if (r.estado === 'ELIMINADA') return { ok: false, error: 'La reserva está eliminada.' };
  await prisma.reserva.update({ where: { id }, data: { estado: 'FINALIZADA' } });
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, id };
}
