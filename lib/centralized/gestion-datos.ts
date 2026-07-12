// Sistema "Gestión de Datos" (Centralizado · pilar · fundamentación).
// Dominio PURO (sin dependencias de DB): tipos, metadatos de nodos del grafo y el
// MOTOR DE NOMENCLATURA de la tubería de clasificación condiciológica.
//
// Tubería (Fase A implementa hasta Categoría):
//   Problemática (REF ≤4) → Problemas · Fuentes (premisa/peso) → Enfrentamientos
//     → Códigos (verificables) → Categorías → [Piezas → Rompecabezas → Subtemas → Temas]

export type TipoDato = 'cantidad' | 'cualidad';
export type TipoLogica = 'premisa' | 'peso';

export const TIPO_DATO_LABEL: Record<TipoDato, string> = {
  cantidad: 'Cantidad',
  cualidad: 'Cualidad',
};
export const TIPO_LOGICA_LABEL: Record<TipoLogica, string> = {
  premisa: 'Premisa',
  peso: 'Peso',
};

// ── Piezas / rompecabezas (Fase B) ────────────────────────────────────────────
export type PiezaTipo = 'revision' | 'correccion';
export type VariableFactor = 'mental' | 'corporal' | 'ambiental';
export type VariableTipo = 'fija' | 'cambia';

export const PIEZA_TIPO_LABEL: Record<PiezaTipo, string> = { revision: 'Revisión', correccion: 'Corrección' };
export const VARIABLE_TIPO_LABEL: Record<VariableTipo, string> = { fija: 'Fija', cambia: 'Cambia' };
export const VARIABLE_FACTOR_LABEL: Record<VariableFactor, string> = { mental: 'Mental', corporal: 'Corporal', ambiental: 'Ambiental' };
export const VARIABLE_FACTOR_COLOR: Record<VariableFactor, string> = { mental: '#f472b6', corporal: '#2dd4bf', ambiental: '#fbbf24' };

/**
 * Restricciones de una variable de pieza (definidas desde el futuro sistema de
 * metodología condiciológica). Gobiernan si dos piezas pueden unirse en un rompecabezas.
 */
export interface VariableRestricciones {
  aplicaMasDeUno?: boolean;         // la variable admite combinarse con varias
  variablesNoAceptadas?: string[];  // nombres de variables incompatibles
  soloCategorias?: string[];        // solo se une con variables de estas categorías
}

// ── Nodos del grafo "universo" ────────────────────────────────────────────────
export type GdNodeType =
  | 'problema'
  | 'fuente_premisa'
  | 'fuente_peso'
  | 'enfrentamiento'
  | 'codigo'
  | 'categoria'
  | 'pieza'
  | 'rompecabezas'
  | 'subtema'
  | 'tema'
  | 'condicion'   // universo de Gestión de Condiciones
  | 'variable';   // universo de Gestión de Condiciones

export type GdShape = 'triangle' | 'circle' | 'square' | 'diamond' | 'hexagon' | 'star' | 'pentagon' | 'doc' | 'card' | 'octagon' | 'ring' | 'dot';

export const GD_NODE_META: Record<GdNodeType, { label: string; plural: string; color: string; shape: GdShape }> = {
  problema:       { label: 'Problema',       plural: 'Problemas',       color: '#f59e0b', shape: 'triangle' }, // ámbar
  fuente_premisa: { label: 'Fuente premisa', plural: 'Fuentes premisa', color: '#22d3ee', shape: 'circle' },   // cian
  fuente_peso:    { label: 'Fuente peso',    plural: 'Fuentes peso',    color: '#60a5fa', shape: 'square' },    // azul
  enfrentamiento: { label: 'Enfrentamiento', plural: 'Enfrentamientos', color: '#a855f7', shape: 'diamond' },  // violeta
  codigo:         { label: 'Código',         plural: 'Códigos',         color: '#10b981', shape: 'hexagon' },   // esmeralda (verif.)
  categoria:      { label: 'Categoría',      plural: 'Categorías',      color: '#eab308', shape: 'star' },      // oro
  pieza:          { label: 'Pieza',          plural: 'Piezas',          color: '#14b8a6', shape: 'pentagon' },  // teal
  rompecabezas:   { label: 'Rompecabezas',   plural: 'Rompecabezas',    color: '#818cf8', shape: 'doc' },       // índigo
  subtema:        { label: 'Subtema',        plural: 'Subtemas',        color: '#f472b6', shape: 'card' },      // rosa
  tema:           { label: 'Tema',           plural: 'Temas',           color: '#fb923c', shape: 'octagon' },   // naranja
  condicion:      { label: 'Condición',      plural: 'Condiciones',     color: '#38bdf8', shape: 'ring' },      // celeste
  variable:       { label: 'Variable',       plural: 'Variables',       color: '#a3e635', shape: 'dot' },       // lima
};

/** Color de un código no verificado (gris) — el verificado usa el color esmeralda del meta. */
export const CODIGO_UNVERIFIED_COLOR = '#6b7280';

export const gdKey = (type: GdNodeType, id: number | string): string => `${type}:${id}`;

export interface GdGraphNode {
  key: string;
  type: GdNodeType;
  id: number;
  title: string;      // nomenclatura o título legible
  subtitle?: string;  // p.ej. contenido corto / credibilidad
  verificado?: boolean; // solo códigos
  incompleta?: boolean; // solo piezas (aún en construcción en Gestión de Condiciones)
  credibilidad?: number; // solo fuentes premisa (efectiva)
}
export interface GdGraphEdge {
  source: string;
  target: string;
  kind?: 'peso' | 'enfrenta' | 'compone' | 'agrupa';
}
export interface GdGraph {
  nodes: GdGraphNode[];
  edges: GdGraphEdge[];
}

// ── MOTOR DE NOMENCLATURA ─────────────────────────────────────────────────────
// Reglas (verbatim del usuario):
//  • Problemática:      REF ≤4 letras, manual (ej. "NROF").
//  • Fuente premisa:    <REF>-<seq>          (seq POR problemática)         → NROF-1
//  • Fuente peso:       Ref-<seq>            (seq GLOBAL en todo el sistema)→ Ref-6
//  • Premisa enfrentada:<REF>-<ganó>.<perdió> (usa los seq de las premisas)  → NROF-1.45
//  • Código:            COD-<REF>-<u1>/<u2>/… (u = "<seq>" o "<ganó>.<perdió>") → COD-NROF-1.45/12
//  • Categoría:         CAT-<seq>-<código…>  (seq POR problemática)         → CAT-1-COD-NROF-1.45/12

/** Normaliza la referencia de una problemática: mayúsculas, solo A-Z, máx. 4. */
export function normalizeProblematicaRef(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
}

export function fuentePremisaRef(problematicaRef: string, seq: number): string {
  return `${problematicaRef}-${seq}`;
}

export function fuentePesoRef(seq: number): string {
  return `Ref-${seq}`;
}

export function enfrentamientoRef(problematicaRef: string, ganadoraSeq: number, perdedoraSeq: number): string {
  return `${problematicaRef}-${ganadoraSeq}.${perdedoraSeq}`;
}

/** Unidad-premisa que compone un código: una premisa suelta o una premisa enfrentada. */
export type CodigoUnidad =
  | { kind: 'premisa'; seq: number }
  | { kind: 'enfrentamiento'; ganadoraSeq: number; perdedoraSeq: number };

export function codigoUnidadToken(u: CodigoUnidad): string {
  return u.kind === 'premisa' ? String(u.seq) : `${u.ganadoraSeq}.${u.perdedoraSeq}`;
}

export function codigoRef(problematicaRef: string, unidades: CodigoUnidad[]): string {
  const tokens = unidades.map(codigoUnidadToken);
  return `COD-${problematicaRef}-${tokens.join('/')}`;
}

/**
 * Nomenclatura de categoría: CAT-<seq>-<nomenclatura del primer código agrupado>.
 * (Provisional P6: si agrupa varios códigos, se usa el 1º como muestra y los demás se
 *  listan aparte en la UI.)
 */
export function categoriaRef(seq: number, codigoRefs: string[]): string {
  const first = codigoRefs[0] || '';
  return first ? `CAT-${seq}-${first}` : `CAT-${seq}`;
}

/**
 * Nomenclatura de pieza: PIE.REV-<base> | PIE.COR-<base>, donde <base> es la nomenclatura
 * de la categoría (o del código) sobre la que se hace la revisión/corrección.
 * Ej. PIE.REV-CAT-1-COD-NROF-1.24/12
 */
export function piezaRef(tipo: PiezaTipo, base: string): string {
  const prefix = tipo === 'revision' ? 'PIE.REV' : 'PIE.COR';
  return base ? `${prefix}-${base}` : prefix;
}

// ── Credibilidad (0–100) ──────────────────────────────────────────────────────
/**
 * Nueva credibilidad efectiva de una premisa al aplicarle una fuente de tipo peso.
 * Una fuente peso SIEMPRE aporta credibilidad a la premisa: se toma el promedio entre la
 * credibilidad actual y la del peso. La CONTRADICCIÓN NO se hace con pesos, sino
 * enfrentando dos premisas (gana la de mayor credibilidad). (Confirmado por el usuario 2026-07-11.)
 */
export function aplicarPeso(actual: number, pesoCred: number): number {
  return Math.round(((actual + pesoCred) / 2) * 100) / 100;
}

export function clampCred(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
