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
};

/** Una celda de las tablas del formato. `etiqueta` = fondo gris y negrita. */
export type Celda = { texto: string; etiqueta?: boolean; ancho?: number; centrado?: boolean; vinetas?: string[] };

/** Un bloque del documento antes o después de la tabla de planificación. */
export type Bloque =
  | { tipo: 'tabla'; numero?: string; titulo: string; filas: Celda[][]; anchos?: number[] }
  | { tipo: 'texto'; numero?: string; titulo: string; texto: string };

/** El documento entero, listo para dibujar. Lo construye `documento.ts`; lo dibujan el PDF y la vista previa. */
export type DocumentoPud = {
  colorCabecera: string;
  institucion: InstitucionConfig;
  tituloDocumento: string;
  datosInformativos: Celda[][];
  tiempo: Celda[][];
  previos: Bloque[];
  /** Número de la sección «PLANIFICACIÓN» (depende de cuántas secciones lleve la institución antes). */
  numeroPlanificacion: number;
  semanas: SemanaDoc[];
  posteriores: Bloque[];
  numeroFirmas: number;
  firmas: { columnas: { titulo: string; cargo: string; nombre: string; fecha: string }[] };
  registro: InstitucionConfig['registroFormato'];
};

/**
 * LA CONFIGURACIÓN DE LA INSTITUCIÓN PARA EL FORMATO. Se edita a nivel de
 * código, por inquilino (Fernando, 2026-09-15). Lo que no tenga la institución
 * se omite del documento.
 */
export type InstitucionConfig = {
  /** Líneas de la cabecera: la del medio va grande y la marcada `acento` en color. */
  cabecera: { texto: string; estilo?: 'normal' | 'grande' | 'acento' }[];
  anioLectivo: string;
  /** Logos (direcciones de imagen PNG/JPG). El primero es el de la institución. */
  logos: string[];
  tituloDocumento: string;
  /** Color de las barras de sección. Por defecto el rojo del formato original (#EF1230): NUNCA el del tema del inquilino (Fernando, 2026-09-16). */
  colorCabecera?: string;
  /** Sección de ejes transversales (pastoral, valores…), si la institución la lleva. */
  ejesTransversales?: { titulo: string; filas: { eje: string; actividades: string[] }[] };
  competencias?: { titulo: string; columnas: string[] };
  inserciones?: { titulo: string; columnas: string[] };
  /** Si lleva la sección de adaptaciones curriculares (vacía, para llenar a mano). */
  adaptaciones: boolean;
  /** Si lleva el espacio del DECE (departamento de consejería estudiantil). */
  dece?: { responsable: string };
  bibliografia: string[];
  registroFormato?: {
    titulo: string;
    elaboradoPor: { cargo: string; nombre: string; fecha: string };
    aprobadoPor: { cargo: string; nombre: string; fecha: string };
  };
};
