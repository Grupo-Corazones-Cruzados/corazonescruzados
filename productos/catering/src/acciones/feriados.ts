'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { aFechaSql, esDia } from '@/lib/fechas';
import { feriadosDeEcuador } from '@/lib/feriados-ecuador';

export type ResultadoFeriado = { ok: true; creados?: number } | { ok: false; error: string };

export async function guardarFeriado(slug: string, id: number | null, datos: FormData): Promise<ResultadoFeriado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const dia = String(datos.get('fecha') || '');
  const nombre = String(datos.get('nombre') || '').trim();
  const esLaborable = datos.get('esLaborable') === 'on' || datos.get('esLaborable') === 'true';
  if (!esDia(dia)) return { ok: false, error: 'La fecha no es válida.' };
  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre del feriado.' };

  const fecha = aFechaSql(dia);
  const repetido = await prisma.feriado.findFirst({
    where: { inquilinoId: ctx.inquilino.id, fecha, id: id ? { not: id } : undefined },
    select: { id: true, nombre: true },
  });
  if (repetido) return { ok: false, error: `Ese día ya está registrado como «${repetido.nombre}».` };

  if (id) {
    const existe = await prisma.feriado.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
    if (!existe) return { ok: false, error: 'El feriado no existe.' };
    await prisma.feriado.update({ where: { id }, data: { fecha, nombre, esLaborable } });
  } else {
    await prisma.feriado.create({ data: { inquilinoId: ctx.inquilino.id, fecha, nombre, esLaborable } });
  }
  revalidatePath(`/${slug}/feriados`);
  return { ok: true };
}

export async function eliminarFeriado(slug: string, id: number): Promise<ResultadoFeriado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const f = await prisma.feriado.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
  if (!f) return { ok: false, error: 'El feriado no existe.' };
  await prisma.feriado.delete({ where: { id } });
  revalidatePath(`/${slug}/feriados`);
  return { ok: true };
}

/** Cargar los feriados nacionales de Ecuador de un año; los que ya existen se dejan como están. */
export async function cargarFeriadosEcuador(slug: string, anio: number): Promise<ResultadoFeriado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) return { ok: false, error: 'El año no es válido.' };

  const existentes = new Set(
    (await prisma.feriado.findMany({ where: { inquilinoId: ctx.inquilino.id }, select: { fecha: true } })).map((f) =>
      f.fecha.toISOString().slice(0, 10),
    ),
  );
  const nuevos = feriadosDeEcuador(anio).filter((f) => !existentes.has(f.fecha));
  if (nuevos.length)
    await prisma.feriado.createMany({
      data: nuevos.map((f) => ({ inquilinoId: ctx.inquilino.id, fecha: aFechaSql(f.fecha), nombre: f.nombre })),
    });
  revalidatePath(`/${slug}/feriados`);
  return { ok: true, creados: nuevos.length };
}
