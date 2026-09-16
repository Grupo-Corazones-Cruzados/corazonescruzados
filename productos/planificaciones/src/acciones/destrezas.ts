'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura, esDuenoOAdmin } from '@/lib/inquilino';
import { imagenADataUrl, normalizarCodigo } from '@/lib/destrezas';

export type Resultado = { ok: true; id?: number } | { ok: false; error: string };

const Campos = z.object({
  codigo: z.string().trim().min(2, 'Escribe el código de la destreza (p. ej. CS.1.1.7.).').max(40),
  descripcion: z.string().trim().min(5, 'Escribe la descripción de la destreza.').max(2000),
  imagenUrl: z.string().trim().max(500_000).optional().or(z.literal('')),
});

async function planificacionEditable(slug: string, planificacionId: number) {
  const permiso = await contextoEscritura(slug, 'planificar');
  if (!permiso.ok) return { ok: false as const, error: permiso.error };
  const { ctx } = permiso;
  const pl = await prisma.planificacion.findFirst({ where: { id: planificacionId, inquilinoId: ctx.inquilino.id } });
  if (!pl) return { ok: false as const, error: 'La planificación no existe.' };
  if (!esDuenoOAdmin(ctx.sesion, pl)) return { ok: false as const, error: 'Solo quien creó la planificación (o el administrador) puede cambiar sus destrezas.' };
  return { ok: true as const, ctx, pl };
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

export async function crearDestreza(slug: string, planificacionId: number, datos: FormData): Promise<Resultado> {
  const p = await planificacionEditable(slug, planificacionId);
  if (!p.ok) return p;
  const leido = Campos.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const codigo = normalizarCodigo(leido.data.codigo);
  const repetida = await prisma.destreza.findFirst({ where: { planificacionId, codigo }, select: { id: true } });
  if (repetida) return { ok: false, error: `Esta planificación ya tiene la destreza ${codigo}.` };
  const img = await leerImagen(datos, null);
  if (!img.ok) return img;
  const ultimo = await prisma.destreza.aggregate({ where: { planificacionId }, _max: { orden: true } });
  const d = await prisma.destreza.create({
    data: { inquilinoId: p.ctx.inquilino.id, planificacionId, nivel: p.pl.nivel, materia: p.pl.materia, codigo, descripcion: leido.data.descripcion, imagenUrl: img.url, orden: (ultimo._max.orden ?? -1) + 1 },
  });
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true, id: d.id };
}

export async function editarDestreza(slug: string, id: number, datos: FormData): Promise<Resultado> {
  const d = await prisma.destreza.findUnique({ where: { id } });
  if (!d?.planificacionId) return { ok: false, error: 'La destreza no existe.' };
  const p = await planificacionEditable(slug, d.planificacionId);
  if (!p.ok) return p;
  const leido = Campos.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const codigo = normalizarCodigo(leido.data.codigo);
  const repetida = await prisma.destreza.findFirst({ where: { planificacionId: d.planificacionId, codigo, id: { not: id } }, select: { id: true } });
  if (repetida) return { ok: false, error: `Esta planificación ya tiene la destreza ${codigo}.` };
  const img = await leerImagen(datos, d.imagenUrl);
  if (!img.ok) return img;
  await prisma.destreza.update({ where: { id }, data: { codigo, descripcion: leido.data.descripcion, imagenUrl: img.url } });
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true, id };
}

/** Quitar una destreza de la planificación. Si alguna semana ya la usa, se desmarca de esa semana (la fila en cascada). */
export async function eliminarDestreza(slug: string, id: number): Promise<Resultado> {
  const d = await prisma.destreza.findUnique({ where: { id } });
  if (!d?.planificacionId) return { ok: false, error: 'La destreza no existe.' };
  const p = await planificacionEditable(slug, d.planificacionId);
  if (!p.ok) return p;
  await prisma.destreza.delete({ where: { id } });
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true };
}
