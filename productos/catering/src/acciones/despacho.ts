'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';

export type ResultadoDespacho = { ok: true; id?: number } | { ok: false; error: string };

const MotorizadoEntrada = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del motorizado.').max(80),
  celular: z.string().trim().regex(/^[0-9]{7,15}$/, 'El celular solo lleva números (7 a 15 dígitos).').optional().or(z.literal('')),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'El color tiene que ser un hexadecimal como #0F6CBD.').optional().or(z.literal('')),
});

export async function guardarMotorizado(slug: string, id: number | null, datos: FormData): Promise<ResultadoDespacho> {
  const permiso = await contextoEscritura(slug, 'despacho');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = MotorizadoEntrada.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;
  const activo = datos.get('activo') !== 'false' && datos.get('activo') !== 'off';

  const repetido = await prisma.motorizado.findFirst({
    where: { inquilinoId: ctx.inquilino.id, nombre: { equals: d.nombre, mode: 'insensitive' }, id: id ? { not: id } : undefined },
    select: { id: true },
  });
  if (repetido) return { ok: false, error: `Ya hay un motorizado llamado «${d.nombre}».` };

  const datosFila = { nombre: d.nombre, celular: d.celular || null, color: d.color ? d.color.toUpperCase() : null, activo };
  if (id) {
    const existe = await prisma.motorizado.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
    if (!existe) return { ok: false, error: 'El motorizado no existe.' };
    await prisma.motorizado.update({ where: { id }, data: datosFila });
  } else {
    const m = await prisma.motorizado.create({ data: { inquilinoId: ctx.inquilino.id, ...datosFila } });
    id = m.id;
  }
  revalidatePath(`/${slug}/motorizados`);
  return { ok: true, id };
}

export async function eliminarMotorizado(slug: string, id: number): Promise<ResultadoDespacho> {
  const permiso = await contextoEscritura(slug, 'despacho');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const m = await prisma.motorizado.findFirst({
    where: { id, inquilinoId: ctx.inquilino.id },
    include: { _count: { select: { clientes: true, clientes2: true } } },
  });
  if (!m) return { ok: false, error: 'El motorizado no existe.' };
  const asignados = m._count.clientes + m._count.clientes2;
  if (asignados)
    return { ok: false, error: `«${m.nombre}» tiene ${asignados} clientes asignados. Reasígnalos o desactívalo.` };
  await prisma.motorizado.delete({ where: { id } });
  revalidatePath(`/${slug}/motorizados`);
  return { ok: true };
}

/** Asignar motorizado a un cliente desde la pantalla de motorizados o de rutas. */
export async function asignarMotorizado(
  slug: string,
  clienteId: number,
  cual: 1 | 2,
  motorizadoId: number | null,
): Promise<ResultadoDespacho> {
  const permiso = await contextoEscritura(slug, 'despacho');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const c = await prisma.cliente.findFirst({ where: { id: clienteId, inquilinoId: ctx.inquilino.id }, select: { id: true } });
  if (!c) return { ok: false, error: 'El cliente no existe.' };
  if (motorizadoId) {
    const m = await prisma.motorizado.findFirst({ where: { id: motorizadoId, inquilinoId: ctx.inquilino.id }, select: { id: true } });
    if (!m) return { ok: false, error: 'El motorizado no existe.' };
  }
  await prisma.cliente.update({
    where: { id: clienteId },
    data: cual === 1 ? { motorizadoId } : { motorizado2Id: motorizadoId },
  });
  revalidatePath(`/${slug}/motorizados`);
  revalidatePath(`/${slug}/rutas`);
  revalidatePath(`/${slug}/clientes/${clienteId}`);
  return { ok: true };
}
