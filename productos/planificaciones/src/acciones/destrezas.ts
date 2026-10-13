'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { imagenADataUrl, normalizarCodigo } from '@/lib/destrezas';
import { fileIdDe, quitarSiHuerfana, renombrarImagen, subirImagen } from '@/lib/mediaGcc';

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

/**
 * La imagen viene como archivo o como dirección; si no viene nada, se conserva la que había.
 * Un archivo va al Google Drive del Grupo a través de la plataforma (2026-10-13), ya no como
 * data URL dentro de la fila.
 */
async function leerImagen(datos: FormData, actual: string | null, o: { inquilino: string; codigo: string }): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const archivo = datos.get('imagen');
  if (archivo instanceof File && archivo.size > 0) {
    const r = await imagenADataUrl(archivo);
    if (!r.ok) return r;
    try {
      return { ok: true, url: await subirImagen(r.url, { inquilino: o.inquilino, referencia: o.codigo, base: o.codigo }) };
    } catch (e: any) {
      return { ok: false, error: `No se pudo guardar la imagen: ${e?.message || 'error con Google Drive'}` };
    }
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
  const img = await leerImagen(datos, null, { inquilino: p.ctx.inquilino.slug, codigo });
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
  const img = await leerImagen(datos, d.imagenUrl, { inquilino: p.ctx.inquilino.slug, codigo });
  if (!img.ok) return img;
  // Nombre del archivo en Drive: se renombra allí PRIMERO; si falla no se guarda nada.
  const nombre = String(datos.get('imagenNombre') ?? '').trim();
  const nombreAntes = String(datos.get('imagenNombreAntes') ?? '').trim();
  if (img.url && img.url === d.imagenUrl && fileIdDe(img.url) && nombre && nombre !== nombreAntes) {
    try { await renombrarImagen(img.url, nombre); }
    catch (e: any) { return { ok: false, error: `No se pudo renombrar la imagen: ${e?.message || 'error con Google Drive'}` }; }
  }
  await prisma.destreza.update({ where: { id }, data: { codigo, descripcion: leido.data.descripcion, criterio: leido.data.criterio || null, indicador: leido.data.indicador || null, imagenUrl: img.url } });
  if (d.imagenUrl && d.imagenUrl !== img.url) await quitarSiHuerfana(d.imagenUrl);
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
  await quitarSiHuerfana(d.imagenUrl);
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
