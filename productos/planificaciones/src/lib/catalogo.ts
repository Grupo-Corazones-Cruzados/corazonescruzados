import type { Nivel } from '@/generated/prisma/enums';

/** Etiquetas de las enumeraciones para la pantalla y el formato. */
export const NIVELES: Nivel[] = ['PREPARATORIA', 'PRIMARIA', 'SECUNDARIA'];

export const ETIQUETA_NIVEL: Record<Nivel, string> = {
  PREPARATORIA: 'Preparatoria',
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
};

export const ETIQUETA_ESTADO_SEMANA = {
  PENDIENTE: 'En cola',
  GENERANDO: 'Redactando…',
  LISTA: 'Lista',
  ERROR: 'Falló',
} as const;

/** El nombre como va en la casilla «Docente» del formato: «Lcda. Helen Cárdenas». */
export const nombreDocente = (u: { nombre: string; profesion: string | null }) =>
  [u.profesion?.trim(), u.nombre.trim()].filter(Boolean).join(' ');
