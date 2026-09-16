/**
 * Lo del horario que necesitan los componentes de CLIENTE, sin arrastrar `pg`:
 * días, horas, etiquetas y tipos.
 */
export const DIAS = [1, 2, 3, 4, 5] as const;
export const ETIQUETA_DIA: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };
export const HORAS = [7, 8, 9, 10, 11, 12, 13, 14] as const;
export const etiquetaHora = (h: number) => `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`;

/** «Sin clase» en el Excel y en las celdas. */
export const SIN_CLASE = 'Sin clase';

export type OpcionMateria = { id: number; etiqueta: string; materia: string; grado: string };

/** «Materia — Grado», que es como se ve en el horario y en el Excel. */
export const etiquetaMateria = (m: { nombre: string; grado: { nombre: string } }) => `${m.nombre} — ${m.grado.nombre}`;

export type CeldaHorario = { dia: number; hora: number; materiaGradoId: number | null };
