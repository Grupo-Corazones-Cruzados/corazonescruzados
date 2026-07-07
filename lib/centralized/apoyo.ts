/**
 * Sistema "Apoyo y Autoayuda" (Global · Implementación). Registra un grafo de
 * conocimiento para apoyar a una persona (candidato/miembro):
 *   Situación → Problemas → Causas   ·   Solución → Problemas + Causas que afecta
 * Problemas/Causas/Soluciones son REUTILIZABLES (una solución que sirvió se puede
 * reaplicar en otras personas). Situaciones son por-sujeto.
 */

export type ApoyoNodeType = 'situation' | 'problem' | 'cause' | 'solution';

export const NODE_TYPES: { key: ApoyoNodeType; label: string; plural: string; color: string }[] = [
  { key: 'situation', label: 'Situación', plural: 'Situaciones', color: '#4B2D8E' }, // accent (morado)
  { key: 'problem', label: 'Problema', plural: 'Problemas', color: '#ef4444' },      // rojo
  { key: 'cause', label: 'Causa', plural: 'Causas', color: '#f59e0b' },              // ámbar
  { key: 'solution', label: 'Solución', plural: 'Soluciones', color: '#22c55e' },    // verde
];

export const NODE_META: Record<ApoyoNodeType, { label: string; plural: string; color: string }> =
  Object.fromEntries(NODE_TYPES.map((t) => [t.key, { label: t.label, plural: t.plural, color: t.color }])) as any;

/** Dimensiones del desarrollo (para situaciones y problemas). */
export const DIMENSIONS: { key: string; label: string }[] = [
  { key: 'laboral', label: 'Laboral' },
  { key: 'corporal', label: 'Corporal' },
  { key: 'mental', label: 'Mental' },
  { key: 'social', label: 'Social' },
];
export const DIMENSION_LABEL: Record<string, string> = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d.label]));

/** Tipos de asociación (aristas) entre nodos. */
export type ApoyoLinkType = 'situation_problem' | 'problem_cause' | 'solution_problem' | 'solution_cause';

export interface GraphNode {
  key: string;            // `${type}:${id}`
  type: ApoyoNodeType;
  id: number;
  title: string;
  dimension?: string | null;
  description?: string | null;
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
