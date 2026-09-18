import { prisma } from '@/lib/db';
import type { Nivel } from '@/generated/prisma/enums';

/**
 * LAS DESTREZAS DE UNA PLANIFICACIÓN (Fernando, 2026-09-16): cada planificación
 * tiene su propio conjunto, del que el agente elige UNA por semana según lo que
 * el docente dicta. Nacen copiadas del catálogo de su materia y nivel (las comunes
 * y las propias de la institución) y desde ahí el docente las edita.
 */
export async function copiarDestrezasDelCatalogo(p: { planificacionId: number; inquilinoId: number; nivel: Nivel; materia: string }) {
  const catalogo = await prisma.destreza.findMany({
    where: { planificacionId: null, nivel: p.nivel, activa: true, OR: [{ inquilinoId: null }, { inquilinoId: p.inquilinoId }], materia: { equals: p.materia, mode: 'insensitive' } },
    orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
  });
  if (!catalogo.length) return 0;
  // Si la institución tiene su propia versión de un código, manda sobre la común.
  const porCodigo = new Map<string, (typeof catalogo)[number]>();
  for (const d of catalogo) if (!porCodigo.has(d.codigo) || d.inquilinoId) porCodigo.set(d.codigo, d);
  let orden = 0;
  await prisma.destreza.createMany({
    data: [...porCodigo.values()].map((d) => ({
      inquilinoId: p.inquilinoId,
      planificacionId: p.planificacionId,
      nivel: d.nivel,
      materia: d.materia,
      codigo: d.codigo,
      descripcion: d.descripcion,
      imagenUrl: d.imagenUrl,
      orden: orden++,
    })),
  });
  return porCodigo.size;
}

/**
 * LAS DESTREZAS DE UNA PLANIFICACIÓN son las de su materia de grado (las gestiona el
 * administrador en «Unidades»; Fernando, 2026-09-17). Las planificaciones viejas sin
 * materia asignada conservan sus copias propias.
 */
export async function destrezasDe(planificacionId: number) {
  const pl = await prisma.planificacion.findUnique({ where: { id: planificacionId }, select: { materiaGradoId: true } });
  const where = pl?.materiaGradoId ? { materiaGradoId: pl.materiaGradoId, activa: true } : { planificacionId, activa: true };
  return prisma.destreza.findMany({ where, orderBy: [{ orden: 'asc' }, { codigo: 'asc' }] });
}

/** Todas las de la materia (seleccionadas o no): para que el administrador elija. */
export const destrezasDeMateria = (materiaGradoId: number) => prisma.destreza.findMany({ where: { materiaGradoId }, orderBy: [{ orden: 'asc' }, { codigo: 'asc' }] });

/** Al crear una materia de grado, nace con las destrezas del catálogo de ese nombre y nivel (con sus iconos). */
export async function sembrarDestrezasDeMateria(p: { materiaGradoId: number; inquilinoId: number; nivel: Nivel; materia: string }) {
  const catalogo = await prisma.destreza.findMany({
    where: { planificacionId: null, materiaGradoId: null, nivel: p.nivel, activa: true, OR: [{ inquilinoId: null }, { inquilinoId: p.inquilinoId }], materia: { equals: p.materia, mode: 'insensitive' } },
    orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
  });
  if (!catalogo.length) return 0;
  const porCodigo = new Map<string, (typeof catalogo)[number]>();
  for (const d of catalogo) if (!porCodigo.has(d.codigo) || d.inquilinoId) porCodigo.set(d.codigo, d);
  let orden = 0;
  await prisma.destreza.createMany({
    data: [...porCodigo.values()].map((d) => ({ inquilinoId: p.inquilinoId, materiaGradoId: p.materiaGradoId, nivel: d.nivel, materia: d.materia, codigo: d.codigo, descripcion: d.descripcion, imagenUrl: d.imagenUrl, orden: orden++ })),
  });
  return porCodigo.size;
}

/** Normaliza un código: sin espacios, mayúsculas, con punto final («cs.1.1.7» → «CS.1.1.7.»). */
export const normalizarCodigo = (c: string) => {
  const t = c.trim().toUpperCase().replace(/\s+/g, '');
  return t && !t.endsWith('.') ? `${t}.` : t;
};

const MAX_IMAGEN = 300 * 1024;
const TIPOS_IMAGEN = ['image/png', 'image/jpeg'];

/**
 * La imagen de una destreza como `data:` URL. PNG o JPG (lo que PDFKit sabe
 * dibujar), hasta 300 KB: son iconos. Devuelve un mensaje de error si no vale.
 */
export async function imagenADataUrl(archivo: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!TIPOS_IMAGEN.includes(archivo.type)) return { ok: false, error: 'La imagen tiene que ser PNG o JPG.' };
  if (archivo.size > MAX_IMAGEN) return { ok: false, error: 'La imagen no puede pasar de 300 KB: son iconos.' };
  const b = Buffer.from(await archivo.arrayBuffer());
  return { ok: true, url: `data:${archivo.type};base64,${b.toString('base64')}` };
}
