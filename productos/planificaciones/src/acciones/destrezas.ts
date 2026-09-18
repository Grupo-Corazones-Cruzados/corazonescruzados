'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { imagenADataUrl, normalizarCodigo } from '@/lib/destrezas';

export type Resultado = { ok: true; id?: number } | { ok: false; error: string };

const Campos = z.object({
  codigo: z.string().trim().min(2, 'Escribe el código de la destreza (p. ej. CS.1.1.7.).').max(40),
  descripcion: z.string().trim().min(5, 'Escribe la descripción de la destreza.').max(2000),
  imagenUrl: z.string().trim().max(500_000).optional().or(z.literal('')),
  criterio: z.string().trim().max(4000).optional().or(z.literal('')),
  indicador: z.string().trim().max(4000).optional().or(z.literal('')),
});

/** Solo el administrador cambia las destrezas de una materia de grado (Fernando, 2026-09-17). */
async function materiaEditable(slug: string, materiaGradoId: number) {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false as const, error: permiso.error };
  const { ctx } = permiso;
  const mg = await prisma.materiaGrado.findFirst({ where: { id: materiaGradoId, inquilinoId: ctx.inquilino.id }, include: { grado: { select: { nivel: true, nombre: true } } } });
  if (!mg) return { ok: false as const, error: 'La materia no existe.' };
  return { ok: true as const, ctx, mg };
}

/** La imagen viene como archivo (se convierte a data URL) o como dirección; si no viene nada, se conserva la que había. */
async function leerImagen(datos: FormData, actual: string | null): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const archivo = datos.get('imagen');
  if (archivo instanceof File && archivo.size > 0) {
    const r = await imagenADataUrl(archivo);
    return r.ok ? { ok: true, url: r.url } : r;
  }
  if (datos.get('quitarImagen') === 'true') return { ok: true, url: null };
  const url = String(datos.get('imagenUrl') || '').trim();
  return { ok: true, url: url || actual };
}

export async function crearDestreza(slug: string, materiaGradoId: number, datos: FormData): Promise<Resultado> {
  const p = await materiaEditable(slug, materiaGradoId);
  if (!p.ok) return p;
  const leido = Campos.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const codigo = normalizarCodigo(leido.data.codigo);
  const repetida = await prisma.destreza.findFirst({ where: { materiaGradoId, codigo }, select: { id: true } });
  if (repetida) return { ok: false, error: `Esta materia ya tiene la destreza ${codigo}.` };
  const img = await leerImagen(datos, null);
  if (!img.ok) return img;
  const ultimo = await prisma.destreza.aggregate({ where: { materiaGradoId }, _max: { orden: true } });
  const d = await prisma.destreza.create({
    data: { inquilinoId: p.ctx.inquilino.id, materiaGradoId, nivel: p.mg.grado.nivel, materia: p.mg.nombre, codigo, descripcion: leido.data.descripcion, criterio: leido.data.criterio || null, indicador: leido.data.indicador || null, imagenUrl: img.url, orden: (ultimo._max.orden ?? -1) + 1 },
  });
  revalidatePath(`/${slug}/unidades`);
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true, id: d.id };
}

export async function editarDestreza(slug: string, id: number, datos: FormData): Promise<Resultado> {
  const d = await prisma.destreza.findUnique({ where: { id } });
  if (!d?.materiaGradoId) return { ok: false, error: 'La destreza no existe.' };
  const p = await materiaEditable(slug, d.materiaGradoId);
  if (!p.ok) return p;
  const leido = Campos.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const codigo = normalizarCodigo(leido.data.codigo);
  const repetida = await prisma.destreza.findFirst({ where: { materiaGradoId: d.materiaGradoId, codigo, id: { not: id } }, select: { id: true } });
  if (repetida) return { ok: false, error: `Esta materia ya tiene la destreza ${codigo}.` };
  const img = await leerImagen(datos, d.imagenUrl);
  if (!img.ok) return img;
  await prisma.destreza.update({ where: { id }, data: { codigo, descripcion: leido.data.descripcion, criterio: leido.data.criterio || null, indicador: leido.data.indicador || null, imagenUrl: img.url } });
  revalidatePath(`/${slug}/unidades`);
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true, id };
}

/** Quitar una destreza de la materia. Si alguna semana ya la usa, se desmarca de esa semana (la fila en cascada). */
export async function eliminarDestreza(slug: string, id: number): Promise<Resultado> {
  const d = await prisma.destreza.findUnique({ where: { id } });
  if (!d?.materiaGradoId) return { ok: false, error: 'La destreza no existe.' };
  const p = await materiaEditable(slug, d.materiaGradoId);
  if (!p.ok) return p;
  await prisma.destreza.delete({ where: { id } });
  revalidatePath(`/${slug}/unidades`);
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true };
}

/** Marcar o desmarcar una destreza para la materia: solo las seleccionadas las ve el docente y las elige el agente (Fernando, 2026-09-17). */
export async function seleccionarDestreza(slug: string, id: number, activa: boolean): Promise<Resultado> {
  const d = await prisma.destreza.findUnique({ where: { id } });
  if (!d?.materiaGradoId) return { ok: false, error: 'La destreza no existe.' };
  const p = await materiaEditable(slug, d.materiaGradoId);
  if (!p.ok) return p;
  await prisma.destreza.update({ where: { id }, data: { activa } });
  revalidatePath(`/${slug}/unidades`);
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true, id };
}
