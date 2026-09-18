import { prisma } from '@/lib/db';

/**
 * EL HORARIO DE CLASES DEL DOCENTE (Fernando, 2026-09-16): lunes a viernes, las
 * ocho horas de 07:00 a 15:00. Cada celda es una materia de un grado de las que
 * el administrador le asignó en «Unidades», o «Sin clase». De aquí sale el
 * NÚMERO DE PERIODOS de cada planificación semanal: las horas que el docente da
 * de esa materia en la semana, y en qué días.
 */
export * from './horario-tipos';
import { etiquetaMateria, type OpcionMateria, type CeldaHorario } from './horario-tipos';

/** Las materias (con su grado) que el administrador asignó a un docente. Un ADMIN puede usar todas las de la institución. */
export async function materiasDelDocente(inquilinoId: number, usuarioId: number, rol: string): Promise<OpcionMateria[]> {
  const filas = await prisma.materiaGrado.findMany({
    where: rol === 'ADMIN' ? { inquilinoId } : { inquilinoId, docentes: { some: { usuarioId } } },
    include: { grado: true },
    orderBy: [{ grado: { orden: 'asc' } }, { orden: 'asc' }, { nombre: 'asc' }],
  });
  return filas.map((m) => ({ id: m.id, etiqueta: etiquetaMateria(m), materia: m.nombre, grado: m.grado.nombre, color: m.grado.color, nivel: m.grado.nivel }));
}

export async function horarioDe(usuarioId: number): Promise<CeldaHorario[]> {
  const filas = await prisma.horarioClase.findMany({ where: { usuarioId }, select: { dia: true, hora: true, materiaGradoId: true } });
  return filas.map((f) => ({ dia: f.dia, hora: f.hora, materiaGradoId: f.materiaGradoId }));
}

export type Periodos = { horas: number; sesiones: { numero: number; dia: number; hora: number }[] };

/**
 * Cuántas horas de una materia da el docente por semana y cuáles son las
 * sesiones, numeradas en el orden de la semana (lunes primero). Es el número de
 * periodos de la planificación semanal y lo que el agente numera día a día.
 */
export async function periodosDe(usuarioId: number, materiaGradoId: number): Promise<Periodos> {
  const filas = await prisma.horarioClase.findMany({ where: { usuarioId, materiaGradoId }, orderBy: [{ dia: 'asc' }, { hora: 'asc' }] });
  return { horas: filas.length, sesiones: filas.map((f, i) => ({ numero: i + 1, dia: f.dia, hora: f.hora })) };
}
