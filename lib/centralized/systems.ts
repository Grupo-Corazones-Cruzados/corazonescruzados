/**
 * Modelo 4P del Proyecto Centralizado + utilidades de ruteo por sistema.
 *
 * Cada sistema tiene su propia URL estable: `/dashboard/centralized/[piso]/[paso]/[slug]`.
 * El `piso` y el `paso` no cambian tras crear el sistema (el editor los bloquea), por
 * lo que la URL es estable y sirve para redirecciones y parámetros (?candidato=…).
 */

export const PISOS = [
  { key: 'global', label: 'Global', hint: 'Sistemas fundamentales' },
  { key: 'pilar', label: 'Pilar', hint: 'Proyectos aprobados' },
  { key: 'controlador', label: 'Controlador', hint: 'Asignación de tareas' },
  { key: 'colaborador', label: 'Colaborador', hint: 'Ejecución de tareas' },
] as const;

export const PASOS = [
  { key: 'fundamentacion', label: 'Fundamentación' },
  { key: 'creacion', label: 'Creación' },
  { key: 'implementacion', label: 'Implementación' },
  { key: 'gestion', label: 'Gestión' },
] as const;

export type PisoKey = (typeof PISOS)[number]['key'];
export type PasoKey = (typeof PASOS)[number]['key'];

export const PISO_LABEL: Record<string, string> = Object.fromEntries(PISOS.map((p) => [p.key, p.label]));
export const PASO_LABEL: Record<string, string> = Object.fromEntries(PASOS.map((p) => [p.key, p.label]));

export const PISO_KEYS = new Set(PISOS.map((p) => p.key));
export const PASO_KEYS = new Set(PASOS.map((p) => p.key));

/**
 * Jerarquía de pisos, de arriba hacia abajo. El acceso a Centralizado es
 * jerárquico por piso: un miembro accede a los sistemas de SU piso y de todos los
 * pisos POR DEBAJO, pero solo en SU paso (exacto).
 */
export const PISO_ORDER: string[] = PISOS.map((p) => p.key); // global > pilar > controlador > colaborador

/** Pisos al nivel del dado y por debajo (p. ej. 'pilar' → pilar, controlador, colaborador). */
export function pisosAtOrBelow(piso: string | null | undefined): string[] {
  const i = PISO_ORDER.indexOf(String(piso ?? ''));
  return i < 0 ? [] : PISO_ORDER.slice(i);
}

export const isPiso = (v: string): v is PisoKey => PISO_KEYS.has(v as PisoKey);
export const isPaso = (v: string): v is PasoKey => PASO_KEYS.has(v as PasoKey);

/** Celda del Modelo 4P (piso × paso) → nombre de la celda. */
export const CELL_MAP: Record<string, Record<string, string>> = {
  global: { fundamentacion: 'Condiciología', creacion: 'Control Psicosocial', implementacion: 'Centralizado', gestion: 'Gestión Psicosocial' },
  pilar: { fundamentacion: 'Academia', creacion: 'Tecnología', implementacion: 'Organización', gestion: 'Publicación' },
  controlador: { fundamentacion: 'Conocimiento', creacion: 'Herramientas', implementacion: 'Estrategias', gestion: 'Soluciones' },
  colaborador: { fundamentacion: 'Investigador', creacion: 'Desarrollador', implementacion: 'Planificador', gestion: 'Líder' },
};

export const cellName = (piso: string, paso: string): string => CELL_MAP[piso]?.[paso] || '';

/** Genera un slug URL-safe a partir de un texto (sin acentos, minúsculas, con guiones). */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface SystemRouteParts {
  piso: string;
  paso: string;
  slug: string;
}

/** Ruta canónica de un sistema del Centralizado. */
export function systemPath({ piso, paso, slug }: SystemRouteParts): string {
  return `/dashboard/centralized/${piso}/${paso}/${slug}`;
}

/* ── Etiquetas de Solicitudes (sistema "Solicitudes y Denuncias") ──────────── */
export const REQUEST_STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', approved: 'success', rejected: 'error',
  exit_no_fee: 'success', exit_with_fee: 'warning',
};
export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado',
  exit_no_fee: 'Salida sin cuota', exit_with_fee: 'Salida con cuota',
};
export const REQUEST_TYPE_LABEL: Record<string, string> = {
  withdrawal: 'Desistimiento', supervised_exit: 'Salida Supervisada',
};
