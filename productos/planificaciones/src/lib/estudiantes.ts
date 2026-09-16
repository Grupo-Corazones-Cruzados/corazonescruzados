import { prisma } from '@/lib/db';

/**
 * LOS ESTUDIANTES DE CADA GRADO (Fernando, 2026-09-16): el docente los da de alta
 * en el módulo «Estudiantes» para los grados en los que tiene materias
 * asignadas (el administrador, en todos). Los que tienen condición especial
 * llevan lo que pide la sección «Ajustes razonables» del formato y generan una
 * línea por planificación semanal.
 */

export type EstudianteVista = {
  id: number;
  nombre: string;
  condicionEspecial: boolean;
  iniciales: string | null;
  condicion: string | null;
  nivelAjuste: string | null;
  enfoque: string | null;
};

export type GradoDelDocente = { id: number; nombre: string; color: string; materias: string[] };

/** Los grados en los que el docente tiene materias asignadas (todos los del inquilino si es ADMIN), con esas materias. */
export async function gradosDelDocente(inquilinoId: number, usuarioId: number, rol: string): Promise<GradoDelDocente[]> {
  const grados = await prisma.grado.findMany({
    where: rol === 'ADMIN' ? { inquilinoId } : { inquilinoId, materias: { some: { docentes: { some: { usuarioId } } } } },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: { materias: { where: rol === 'ADMIN' ? {} : { docentes: { some: { usuarioId } } }, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }], select: { nombre: true } } },
  });
  return grados.map((g) => ({ id: g.id, nombre: g.nombre, color: g.color, materias: g.materias.map((m) => m.nombre) }));
}

/** Si el docente puede tocar los estudiantes de un grado: tiene una materia en él, o es ADMIN. */
export async function puedeEnGrado(inquilinoId: number, usuarioId: number, rol: string, gradoId: number): Promise<boolean> {
  const g = await prisma.grado.findFirst({
    where: rol === 'ADMIN' ? { id: gradoId, inquilinoId } : { id: gradoId, inquilinoId, materias: { some: { docentes: { some: { usuarioId } } } } },
    select: { id: true },
  });
  return Boolean(g);
}

export async function estudiantesDe(gradoId: number): Promise<EstudianteVista[]> {
  const filas = await prisma.estudiante.findMany({ where: { gradoId }, orderBy: { nombre: 'asc' } });
  return filas.map((e) => ({ id: e.id, nombre: e.nombre, condicionEspecial: e.condicionEspecial, iniciales: e.iniciales, condicion: e.condicion, nivelAjuste: e.nivelAjuste, enfoque: e.enfoque }));
}

/** Los estudiantes con condición especial del grado de una materia: una línea de ajustes razonables cada uno, por semana. */
export async function estudiantesConCondicion(materiaGradoId: number | null) {
  if (!materiaGradoId) return [];
  const mg = await prisma.materiaGrado.findUnique({ where: { id: materiaGradoId }, select: { gradoId: true } });
  if (!mg) return [];
  return prisma.estudiante.findMany({ where: { gradoId: mg.gradoId, condicionEspecial: true }, orderBy: { nombre: 'asc' } });
}
