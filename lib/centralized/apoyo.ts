/**
 * Sistema "Apoyo y Autoayuda" (Global · Implementación). Registra un grafo de
 * conocimiento para apoyar a una persona (candidato/miembro):
 *   Situación → Problemas → Causas   ·   Solución → Problemas + Causas que afecta
 * Problemas/Causas/Soluciones son REUTILIZABLES (una solución que sirvió se puede
 * reaplicar en otras personas). Situaciones son por-sujeto.
 */

export type ApoyoNodeType = 'situation' | 'problem' | 'cause' | 'alternative' | 'solution';

export const NODE_TYPES: { key: ApoyoNodeType; label: string; plural: string; color: string }[] = [
  { key: 'situation', label: 'Situación', plural: 'Situaciones', color: '#8b5cf6' }, // violeta vivo (visible en negro)
  { key: 'problem', label: 'Problema', plural: 'Problemas', color: '#ef4444' },      // rojo
  { key: 'cause', label: 'Causa', plural: 'Causas', color: '#f59e0b' },              // ámbar
  { key: 'alternative', label: 'Alternativa', plural: 'Alternativas', color: '#38bdf8' }, // celeste (idea propuesta)
  { key: 'solution', label: 'Solución', plural: 'Soluciones', color: '#22c55e' },    // verde (comprobada)
];

export const NODE_META: Record<ApoyoNodeType, { label: string; plural: string; color: string }> =
  Object.fromEntries(NODE_TYPES.map((t) => [t.key, { label: t.label, plural: t.plural, color: t.color }])) as any;

/** Dimensiones del desarrollo (obligatorias en los problemas). Cada una tiene un color
 *  distintivo (anillo en el grafo) que NO choca con los colores de tipo de nodo. */
export const DIMENSIONS: { key: string; label: string; color: string }[] = [
  { key: 'laboral', label: 'Laboral', color: '#3b82f6' },   // azul
  { key: 'corporal', label: 'Corporal', color: '#14b8a6' }, // teal
  { key: 'mental', label: 'Mental', color: '#ec4899' },     // rosa
  { key: 'social', label: 'Social', color: '#eab308' },     // amarillo
];
export const DIMENSION_LABEL: Record<string, string> = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d.label]));
export const DIMENSION_COLOR: Record<string, string> = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d.color]));

/** Tipos de asociación (aristas) entre nodos. */
export type ApoyoLinkType = 'situation_problem' | 'problem_cause' | 'solution_problem' | 'solution_cause';

export interface GraphNode {
  key: string;            // `${type}:${id}`
  type: ApoyoNodeType;
  id: number;
  title: string;
  dimension?: string | null;
  description?: string | null;
  linkSource?: 'ticket' | 'project' | null; // alternativa/solución con ticket o proyecto asociado
}
export interface GraphEdge {
  source: string;         // node key
  target: string;         // node key
  type: ApoyoLinkType;
}
export interface ApoyoGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const nodeKey = (type: ApoyoNodeType, id: number | string) => `${type}:${id}`;
