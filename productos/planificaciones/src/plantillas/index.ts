import type { DocumentoPud, InstitucionConfig, PlanificacionDoc, SemanaDoc } from './tipos';
import { armarDocumento } from './pud/documento';
import { armarSistema, armarEncargo, type DatosEncargo } from './pud/sistema';
import { ESQUEMA_SEMANA, type SalidaSemana } from './pud/esquema';
import { pdfPud } from './pud/pdf';
import { wordPud } from './pud/word';
import { serializarEstrategias } from './pud/estrategias';

/**
 * EL REGISTRO DE PLANTILLAS. Una plantilla = formato del documento + system
 * prompt + esquema de salida. Se elige por clave desde «Configurar» en cada
 * planificación; la institución tiene una por defecto. Por ahora hay una: «pud».
 */
export type Plantilla = {
  clave: string;
  nombre: string;
  descripcion: string;
  sistema: () => string;
  encargo: (d: DatosEncargo) => string;
  esquema: { nombre: string; schema: Record<string, unknown> };
  /** Del JSON del agente a las columnas de la fila. */
  aColumnas: (s: SalidaSemana) => {
    tema: string;
    objetivosTema: string;
    estrategias: string;
    recursos: string;
    tecnica: string;
    instrumento: string;
  };
  documento: (p: { planificacion: PlanificacionDoc; semanas: SemanaDoc[]; institucion: InstitucionConfig; zonaHoraria: string }) => DocumentoPud;
  pdf: (doc: DocumentoPud) => Promise<Buffer>;
  word: (doc: DocumentoPud) => Promise<Buffer>;
};

const PUD: Plantilla = {
  clave: 'pud',
  nombre: 'Plan de Unidad Didáctica (PUD)',
  descripcion: 'El formato por semanas: tema, periodos, objetivos, destrezas, estrategias por fases del ciclo ACC, recursos, técnica e instrumento.',
  sistema: armarSistema,
  encargo: armarEncargo,
  esquema: ESQUEMA_SEMANA,
  aColumnas: (s) => ({
    tema: s.tema.trim(),
    objetivosTema: s.objetivosTema.trim(),
    estrategias: serializarEstrategias(s.estrategias),
    recursos: s.recursos.map((r) => r.trim()).filter(Boolean).join('\n'),
    tecnica: s.tecnica.map((r) => r.trim()).filter(Boolean).join('\n'),
    instrumento: s.instrumento.map((r) => r.trim()).filter(Boolean).join('\n'),
  }),
  documento: armarDocumento,
  pdf: pdfPud,
  word: wordPud,
};

export const PLANTILLAS: Record<string, Plantilla> = { pud: PUD };
export const PLANTILLA_POR_DEFECTO = 'pud';

export const plantillaDe = (clave: string | null | undefined): Plantilla => PLANTILLAS[clave ?? ''] ?? PUD;
export const listaDePlantillas = () => Object.values(PLANTILLAS).map((p) => ({ clave: p.clave, nombre: p.nombre, descripcion: p.descripcion }));
