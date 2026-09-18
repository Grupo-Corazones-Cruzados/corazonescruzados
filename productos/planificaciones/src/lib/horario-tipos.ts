/**
 * Lo del horario que necesitan los componentes de CLIENTE, sin arrastrar `pg`:
 * días, periodos, etiquetas y tipos.
 *
 * LA JORNADA (Fernando, 2026-09-16, con el horario real de la docente): periodos
 * de 40 minutos desde las 07:10 hasta las 15:00, con el RECESO de 09:10 a 09:40
 * entre el 3.º y el 4.º. Once periodos; cada docente marca los suyos y deja
 * vacíos o «Sin clase» los demás (en Preparatoria, a las 12:20 empieza la
 * preparación para la salida; en otros grados hay clase hasta las 15:00).
 */
export const DIAS = [1, 2, 3, 4, 5] as const;
export const ETIQUETA_DIA: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };

export type Periodo = { numero: number; desde: string; hasta: string };

/** Los once periodos de clase (el `hora` de `horario_clases` es el número del periodo). */
export const PERIODOS: readonly Periodo[] = [
  { numero: 1, desde: '07:10', hasta: '07:50' },
  { numero: 2, desde: '07:50', hasta: '08:30' },
  { numero: 3, desde: '08:30', hasta: '09:10' },
  { numero: 4, desde: '09:40', hasta: '10:20' },
  { numero: 5, desde: '10:20', hasta: '11:00' },
  { numero: 6, desde: '11:00', hasta: '11:40' },
  { numero: 7, desde: '11:40', hasta: '12:20' },
  { numero: 8, desde: '12:20', hasta: '13:00' },
  { numero: 9, desde: '13:00', hasta: '13:40' },
  { numero: 10, desde: '13:40', hasta: '14:20' },
  { numero: 11, desde: '14:20', hasta: '15:00' },
];
/** El receso va después de este periodo. */
export const RECESO = { trasPeriodo: 3, desde: '09:10', hasta: '09:40' };

/** Los números de periodo válidos (lo que se guarda en `hora`). */
export const HORAS = PERIODOS.map((p) => p.numero);

/** «07:10 – 07:50». */
export const etiquetaHora = (numero: number) => {
  const p = PERIODOS.find((x) => x.numero === numero);
  return p ? `${p.desde} – ${p.hasta}` : String(numero);
};
/** «1 · 07:10 – 07:50», la primera columna del Excel. */
export const etiquetaPeriodo = (numero: number) => `${numero} · ${etiquetaHora(numero)}`;

/** «Sin clase» en el Excel y en las celdas. */
export const SIN_CLASE = 'Sin clase';

export type OpcionMateria = { id: number; etiqueta: string; materia: string; grado: string; color: string; nivel: string };

/** «Materia — Grado», que es como se ve en el horario y en el Excel. */
export const etiquetaMateria = (m: { nombre: string; grado: { nombre: string } }) => `${m.nombre} — ${m.grado.nombre}`;

export type CeldaHorario = { dia: number; hora: number; materiaGradoId: number | null };
