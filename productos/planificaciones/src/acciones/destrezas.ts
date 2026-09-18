'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura, esDuenoOAdmin } from '@/lib/inquilino';
import { imagenADataUrl, normalizarCodigo } from '@/lib/destrezas';
import { MAX_TAMANO, extraerTexto, tipoDe } from '@/lib/adjuntos';
import { correrAgente } from '@/lib/ia';
import { ETIQUETA_NIVEL } from '@/lib/catalogo';
import { ESQUEMA_DESTREZAS, SISTEMA_DESTREZAS, type SalidaDestrezas } from '@/plantillas/pud/importar-destrezas';

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

/**
 * IMPORTAR DESTREZAS DESDE UN PCA (Fernando, 2026-09-17): el docente sube el PDF o
 * Word y el agente transcribe las destrezas de la materia y el nivel de la
 * planificación (en Preparatoria, la columna «Preparatoria»). Se añaden las que
 * la planificación no tenga, sin imagen (los iconos se ponen a mano al editar).
 */
export type ResultadoImportacion = { ok: true; anadidas: number; repetidas: number } | { ok: false; error: string };

export async function importarDestrezas(slug: string, planificacionId: number, datos: FormData): Promise<ResultadoImportacion> {
  const p = await planificacionEditable(slug, planificacionId);
  if (!p.ok) return p;
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: 'Adjunta el PDF o el Word con las destrezas.' };
  if (archivo.size > MAX_TAMANO) return { ok: false, error: 'El archivo pasa de 10 MB.' };
  const tipo = tipoDe(archivo);
  if (tipo !== 'application/pdf' && tipo !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return { ok: false, error: 'Tiene que ser un PDF o un Word (.docx).' };
  let texto: string;
  try {
    texto = (await extraerTexto(Buffer.from(await archivo.arrayBuffer()), tipo)).replace(/\u0000/g, '').trim();
  } catch (e) {
    return { ok: false, error: `No se pudo leer el archivo: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (texto.length < 100) return { ok: false, error: 'El archivo no tiene texto legible (¿es un PDF escaneado?).' };

  const r = await correrAgente<SalidaDestrezas>({
    sistema: SISTEMA_DESTREZAS,
    encargo: `MATERIA: ${p.pl.materia}\nNIVEL: ${ETIQUETA_NIVEL[p.pl.nivel]}\n\nTEXTO DEL DOCUMENTO (${archivo.name}):\n\n${texto}\n\nDevuelve las destrezas con criterio de desempeño de ese nivel en el JSON pedido.`,
    esquema: ESQUEMA_DESTREZAS,
    esfuerzo: 'low',
    maxSalida: 20_000,
    claveCache: 'planificaciones-importar-destrezas',
  });
  if (!r.ok) return { ok: false, error: r.error };
  const encontradas = r.salida.destrezas.map((d) => ({ codigo: normalizarCodigo(d.codigo), descripcion: d.descripcion.trim() })).filter((d) => /^[A-ZÑ]{1,4}\.\d+\.\d+\.\d+\.?$/i.test(d.codigo) && d.descripcion.length >= 5);
  if (!encontradas.length) return { ok: false, error: 'El agente no encontró destrezas con código en el documento para ese nivel.' };

  const actuales = await prisma.destreza.findMany({ where: { planificacionId }, select: { codigo: true, orden: true } });
  const tiene = new Set(actuales.map((d) => d.codigo.trim().toUpperCase().replace(/\.$/, '')));
  let orden = actuales.reduce((a, d) => Math.max(a, d.orden), -1) + 1;
  const vistas = new Set<string>();
  const nuevas: { codigo: string; descripcion: string }[] = [];
  for (const d of encontradas) {
    const clave = d.codigo.toUpperCase().replace(/\.$/, '');
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    if (!tiene.has(clave)) nuevas.push(d);
  }
  if (nuevas.length) {
    // Si el catálogo común tiene el icono de ese código, se hereda.
    const catalogo = await prisma.destreza.findMany({ where: { planificacionId: null, nivel: p.pl.nivel, codigo: { in: nuevas.map((d) => d.codigo) }, OR: [{ inquilinoId: null }, { inquilinoId: p.ctx.inquilino.id }] }, select: { codigo: true, imagenUrl: true } });
    const icono = new Map(catalogo.filter((c) => c.imagenUrl).map((c) => [c.codigo, c.imagenUrl]));
    await prisma.destreza.createMany({
      data: nuevas.map((d) => ({ inquilinoId: p.ctx.inquilino.id, planificacionId, nivel: p.pl.nivel, materia: p.pl.materia, codigo: d.codigo, descripcion: d.descripcion, imagenUrl: icono.get(d.codigo) ?? null, orden: orden++ })),
    });
  }
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true, anadidas: nuevas.length, repetidas: vistas.size - nuevas.length };
}
