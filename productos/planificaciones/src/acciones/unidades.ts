'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { colorAleatorio, esColorDeGrado } from '@/lib/grados-color';
import { contextoEscritura } from '@/lib/inquilino';

export type Resultado = { ok: true; id?: number } | { ok: false; error: string };

/**
 * EL MÓDULO «UNIDADES» (Fernando, 2026-09-16): el administrador arma la lista de
 * grados y, por grado, sus materias con descripción, docentes que la dan y
 * cantidad de unidades. Es de donde salen las materias que un docente puede
 * elegir al planificar y poner en su horario.
 */
const Nombre = z.string().trim().min(1, 'Escribe el nombre.').max(120);

export async function crearGrado(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const nombre = Nombre.safeParse(datos.get('nombre'));
  if (!nombre.success) return { ok: false, error: nombre.error.issues[0].message };
  const repetido = await prisma.grado.findUnique({ where: { inquilinoId_nombre: { inquilinoId: permiso.ctx.inquilino.id, nombre: nombre.data } } });
  if (repetido) return { ok: false, error: `Ya existe el grado «${nombre.data}».` };
  const ultimo = await prisma.grado.aggregate({ where: { inquilinoId: permiso.ctx.inquilino.id }, _max: { orden: true } });
  // El color se elige al azar entre los que aún no usa otro grado de la institución (Fernando, 2026-09-16).
  const usados = (await prisma.grado.findMany({ where: { inquilinoId: permiso.ctx.inquilino.id }, select: { color: true } })).map((x) => x.color);
  const g = await prisma.grado.create({ data: { inquilinoId: permiso.ctx.inquilino.id, nombre: nombre.data, color: colorAleatorio(usados), orden: (ultimo._max.orden ?? -1) + 1 } });
  revalidatePath(`/${slug}/unidades`);
  return { ok: true, id: g.id };
}

export async function renombrarGrado(slug: string, id: number, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const nombre = Nombre.safeParse(datos.get('nombre'));
  if (!nombre.success) return { ok: false, error: nombre.error.issues[0].message };
  const g = await prisma.grado.findFirst({ where: { id, inquilinoId: permiso.ctx.inquilino.id } });
  if (!g) return { ok: false, error: 'El grado no existe.' };
  const color = datos.get('color');
  await prisma.grado.update({ where: { id }, data: { nombre: nombre.data, ...(esColorDeGrado(color) ? { color } : {}) } });
  revalidatePath(`/${slug}/unidades`);
  return { ok: true, id };
}

/** Borrar un grado se lleva sus materias, sus asignaciones y sus horas del horario; las planificaciones quedan (con la materia a nulo). */
export async function eliminarGrado(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const g = await prisma.grado.findFirst({ where: { id, inquilinoId: permiso.ctx.inquilino.id } });
  if (!g) return { ok: false, error: 'El grado no existe.' };
  await prisma.grado.delete({ where: { id } });
  revalidatePath(`/${slug}/unidades`);
  return { ok: true };
}

const Materia = z.object({
  nombre: Nombre,
  descripcion: z.string().trim().max(2000).optional().or(z.literal('')),
  unidades: z.string().trim().optional().or(z.literal('')),
});

const leerUnidades = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : NaN;
};

export async function crearMateria(slug: string, gradoId: number, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const g = await prisma.grado.findFirst({ where: { id: gradoId, inquilinoId: permiso.ctx.inquilino.id } });
  if (!g) return { ok: false, error: 'El grado no existe.' };
  const leido = Materia.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const unidades = leerUnidades(leido.data.unidades);
  if (Number.isNaN(unidades)) return { ok: false, error: 'La cantidad de unidades es un número entero (0 a 99).' };
  const repetida = await prisma.materiaGrado.findUnique({ where: { gradoId_nombre: { gradoId, nombre: leido.data.nombre } } });
  if (repetida) return { ok: false, error: `El grado ya tiene la materia «${leido.data.nombre}».` };
  const ultimo = await prisma.materiaGrado.aggregate({ where: { gradoId }, _max: { orden: true } });
  const docentes = datos.getAll('docentes').map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const m = await prisma.materiaGrado.create({
    data: {
      inquilinoId: permiso.ctx.inquilino.id,
      gradoId,
      nombre: leido.data.nombre,
      descripcion: leido.data.descripcion || null,
      unidades,
      orden: (ultimo._max.orden ?? -1) + 1,
      docentes: { create: (await docentesValidos(permiso.ctx.inquilino.id, docentes)).map((usuarioId) => ({ usuarioId })) },
    },
  });
  revalidatePath(`/${slug}/unidades`);
  return { ok: true, id: m.id };
}

export async function editarMateria(slug: string, id: number, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const m = await prisma.materiaGrado.findFirst({ where: { id, inquilinoId: permiso.ctx.inquilino.id } });
  if (!m) return { ok: false, error: 'La materia no existe.' };
  const leido = Materia.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const unidades = leerUnidades(leido.data.unidades);
  if (Number.isNaN(unidades)) return { ok: false, error: 'La cantidad de unidades es un número entero (0 a 99).' };
  const repetida = await prisma.materiaGrado.findFirst({ where: { gradoId: m.gradoId, nombre: leido.data.nombre, id: { not: id } } });
  if (repetida) return { ok: false, error: `El grado ya tiene la materia «${leido.data.nombre}».` };
  const docentes = await docentesValidos(permiso.ctx.inquilino.id, datos.getAll('docentes').map(Number).filter((n) => Number.isInteger(n) && n > 0));
  await prisma.$transaction([
    prisma.materiaDocente.deleteMany({ where: { materiaGradoId: id } }),
    prisma.materiaGrado.update({
      where: { id },
      data: { nombre: leido.data.nombre, descripcion: leido.data.descripcion || null, unidades, docentes: { create: docentes.map((usuarioId) => ({ usuarioId })) } },
    }),
  ]);
  revalidatePath(`/${slug}/unidades`);
  return { ok: true, id };
}

export async function eliminarMateria(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const m = await prisma.materiaGrado.findFirst({ where: { id, inquilinoId: permiso.ctx.inquilino.id } });
  if (!m) return { ok: false, error: 'La materia no existe.' };
  await prisma.materiaGrado.delete({ where: { id } });
  revalidatePath(`/${slug}/unidades`);
  return { ok: true };
}

/** Solo cuentas activas de la propia institución. */
async function docentesValidos(inquilinoId: number, ids: number[]) {
  if (!ids.length) return [];
  const filas = await prisma.usuario.findMany({ where: { id: { in: ids }, inquilinoId, activo: true }, select: { id: true } });
  return filas.map((f) => f.id);
}
