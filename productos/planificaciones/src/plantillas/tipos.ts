import type { Nivel } from '@/generated/prisma/enums';

/**
 * LO QUE ES UNA PLANTILLA: un formato de documento + su system prompt. Las
 * plantillas viven en código (`src/plantillas/<clave>/`) y la fila de la
 * planificación solo guarda la clave. La primera es «pud» (Plan de Unidad
 * Didáctica, el formato de los diez ejemplos de la docente).
 */

/** Los datos de una semana ya generada, tal como los usan el PDF y la vista previa. */
export type SemanaDoc = {
  orden: number;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  tema: string | null;
  numeroPeriodos: string | null;
  objetivosTema: string | null;
  estrategias: string | null;
  recursos: string | null;
  tecnica: string | null;
  instrumento: string | null;
  destrezas: { codigo: string; descripcion: string; imagenUrl: string | null }[];
};

export type PlanificacionDoc = {
  nivel: Nivel;
  materia: string;
  ambito: string;
  numeroUnidad: number;
  tituloUnidad: string;
  inicioPud: string;
  finPud: string;
  gradoCurso: string | null;
  paralelo: string | null;
  jornada: string | null;
  objetivosUnidad: string | null;
  criteriosEvaluacion: string | null;
  elaboradoPor: string | null;
  revisadoPor: string | null;
  revisadoCargo: string | null;
  aprobadoPor: string | null;
  aprobadoCargo: string | null;
  docente: string;
  /** El «Registro de formato» del pie: variable por planificación (Fernando, 2026-09-16). */
  registro: {
    titulo: string | null;
    elaboradoCargo: string | null;
    elaboradoNombre: string | null;
    elaboradoFecha: string | null;
    aprobadoCargo: string | null;
    aprobadoNombre: string | null;
    aprobadoFecha: string | null;
  };
};

/** Una celda de las tablas del formato. `etiqueta` = fondo gris y negrita; `titulo` = fondo rojo y texto blanco. */
export type Celda = { texto: string; etiqueta?: boolean; titulo?: boolean; ancho?: number; centrado?: boolean; vinetas?: string[]; imagen?: string; cursiva?: boolean };

/** Un bloque del documento antes o después de la tabla de planificación. */
export type Bloque =
  /** Barra roja de título + tabla. */
  | { tipo: 'tabla'; numero?: string; titulo: string; filas: Celda[][]; anchos?: number[]; altoMinMm?: number }
  /** Barra roja de título + una sola celda de texto. */
  | { tipo: 'texto'; numero?: string; titulo: string; texto: string }
  /** Celda roja de título A LA IZQUIERDA + columnas con su etiqueta gris y su icono debajo (competencias, inserciones). */
  | { tipo: 'lateral'; numero?: string; titulo: string; columnas: { texto: string; icono: string }[] }
  /** Celda roja de título a la izquierda + una celda de texto (observaciones). */
  | { tipo: 'lateral-texto'; numero?: string; titulo: string; texto: string; altoMinMm?: number };

/**
 * LO QUE EL NEGOCIO LLEVA IMPRESO EN EL FORMATO: lo edita el administrador en el
 * módulo «Negocio» (Fernando, 2026-09-16). Las tres líneas de la cabecera, el año
 * lectivo, los tres logos (institución · organización principal · opcional) y el
 * responsable del DECE.
 */
export type InstitucionConfig = {
  cabecera: { texto: string; estilo?: 'normal' | 'grande' | 'acento' }[];
  anioLectivo: string;
  /** Hasta tres: institución, organización principal, opcional. Direcciones o `data:` URL. */
  logos: string[];
  deceResponsable: string;
};

/** El documento entero, listo para dibujar. Lo construye `documento.ts`; lo dibujan el PDF, el Word y la vista previa. */
export type DocumentoPud = {
  colorCabecera: string;
  institucion: InstitucionConfig;
  tituloDocumento: string;
  datosInformativos: Celda[][];
  tiempo: Celda[][];
  previos: Bloque[];
  /** Número de la sección «PLANIFICACIÓN» (depende de cuántas secciones lleve antes). */
  numeroPlanificacion: number;
  semanas: SemanaDoc[];
  posteriores: Bloque[];
  numeroFirmas: number;
  /** Firmas de responsabilidad: tres columnas, cada una con su cargo, su nombre y la fecha del día. */
  firmas: { columnas: { titulo: string; cargo: string; nombre: string; fecha: string }[] };
  /** El «Registro de formato» del pie (siempre se dibuja; con lo que haya). */
  registro: {
    titulo: string;
    elaboradoPor: { cargo: string; nombre: string; fecha: string };
    aprobadoPor: { cargo: string; nombre: string; fecha: string };
  };
};
