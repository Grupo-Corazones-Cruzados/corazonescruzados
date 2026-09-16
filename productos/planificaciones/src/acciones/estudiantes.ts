'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { puedeEnGrado } from '@/lib/estudiantes';

export type Resultado = { ok: true; id?: number } | { ok: false; error: string };

/**
 * EL MÓDULO «ESTUDIANTES» (Fernando, 2026-09-16): el docente guarda a los
 * estudiantes de sus grados con el nombre completo y si tienen condición
 * especial; si la tienen, se piden las iniciales, la condición reportada, el
 * nivel de ajuste razonable y el enfoque —los mismos campos que la sección
 * «Ajustes razonables» del formato—.
 */
const Datos = z
  .object({
    nombre: z.string().trim().min(1, 'Escribe el nombre completo.').max(160),
    condicionEspecial: z.enum(['si', 'no']),
    iniciales: z.string().trim().max(20).optional().or(z.literal('')),
    condicion: z.string().trim().max(200).optional().or(z.literal('')),
    nivelAjuste: z.string().trim().max(80).optional().or(z.literal('')),
    enfoque: z.string().trim().max(2000).optional().or(z.literal('')),
  })
  .superRefine((d, ctx) => {
    if (d.condicionEspecial !== 'si') return;
    if (!d.iniciales) ctx.addIssue({ code: 'custom', path: ['iniciales'], message: 'Escribe las iniciales del estudiante.' });
    if (!d.condicion) ctx.addIssue({ code: 'custom', path: ['condicion'], message: 'Escribe la condición reportada.' });
    if (!d.nivelAjuste) ctx.addIssue({ code: 'custom', path: ['nivelAjuste'], message: 'Escribe el nivel de ajuste razonable.' });
    if (!d.enfoque) ctx.addIssue({ code: 'custom', path: ['enfoque'], message: 'Escribe el enfoque.' });
  });

function leer(datos: FormData) {
  return Datos.safeParse({
    nombre: datos.get('nombre'),
    condicionEspecial: datos.get('condicionEspecial') ?? 'no',
    iniciales: datos.get('iniciales') ?? '',
    condicion: datos.get('condicion') ?? '',
    nivelAjuste: datos.get('nivelAjuste') ?? '',
    enfoque: datos.get('enfoque') ?? '',
  });
}

const aFila = (d: z.infer<typeof Datos>) => {
  const con = d.condicionEspecial === 'si';
  return {
    nombre: d.nombre,
    condicionEspecial: con,
    iniciales: con ? d.iniciales || null : null,
    condicion: con ? d.condicion || null : null,
    nivelAjuste: con ? d.nivelAjuste || null : null,
    enfoque: con ? d.enfoque || null : null,
  };
};

export async function crearEstudiante(slug: string, gradoId: number, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'planificar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { inquilino, sesion } = permiso.ctx;
  if (!(await puedeEnGrado(inquilino.id, sesion.uid, sesion.rol, gradoId))) return { ok: false, error: 'No tienes materias en ese grado.' };
  const d = leer(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0].message };
  const e = await prisma.estudiante.create({ data: { inquilinoId: inquilino.id, gradoId, ...aFila(d.data) } });
  revalidatePath(`/${slug}/estudiantes`);
  return { ok: true, id: e.id };
}

export async function editarEstudiante(slug: string, id: number, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'planificar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { inquilino, sesion } = permiso.ctx;
  const e = await prisma.estudiante.findFirst({ where: { id, inquilinoId: inquilino.id } });
  if (!e) return { ok: false, error: 'El estudiante no existe.' };
  if (!(await puedeEnGrado(inquilino.id, sesion.uid, sesion.rol, e.gradoId))) return { ok: false, error: 'No tienes materias en ese grado.' };
  const d = leer(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0].message };
  await prisma.estudiante.update({ where: { id }, data: aFila(d.data) });
  revalidatePath(`/${slug}/estudiantes`);
  return { ok: true, id };
}

export async function eliminarEstudiante(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'planificar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { inquilino, sesion } = permiso.ctx;
  const e = await prisma.estudiante.findFirst({ where: { id, inquilinoId: inquilino.id } });
  if (!e) return { ok: false, error: 'El estudiante no existe.' };
  if (!(await puedeEnGrado(inquilino.id, sesion.uid, sesion.rol, e.gradoId))) return { ok: false, error: 'No tienes materias en ese grado.' };
  // Sus líneas de ajustes razonables se van con él (cascada).
  await prisma.estudiante.delete({ where: { id } });
  revalidatePath(`/${slug}/estudiantes`);
  return { ok: true };
}
