/**
 * Sistema "Comandos Violeta" (Global · Creación, celda "Control Psicosocial").
 *
 * Configura MODELOS ORGANIZACIONALES: el usuario global crea **políticas**
 * (agrupadas por **categoría**) que puede **activar/desactivar**. Cada política
 * contiene un conjunto de **funciones** que, al activarse la política, generan
 * acciones en toda la app:
 *   - Mensaje permanente (header del /dashboard)
 *   - Bloqueo de acceso a módulos (seguridad; solo admin pasa)
 *   - Generación de tareas programadas a usuarios
 *
 * Iteración 1: AUTORÍA + persistencia (esta lib + UI + API). La APLICACIÓN al
 * activar (enforcement) se construye después.
 */

/* ── Grafo (mismo patrón visual que Apoyo, con FORMAS nuevas) ───────────────── */
// Política = ESTRELLA · Función = PENTÁGONO (formas no usadas en Apoyo:
// hexágono/triángulo/círculo/cuadrado/rombo).
export type PolicyNodeType = 'policy' | 'function';

export const POLICY_META: Record<PolicyNodeType, { label: string; plural: string; color: string }> = {
  policy: { label: 'Política', plural: 'Políticas', color: '#a855f7' },   // violeta
  function: { label: 'Función', plural: 'Funciones', color: '#22d3ee' },  // cian
};

/* ── Tipos de función y sus acciones ────────────────────────────────────────── */
export type FunctionType = 'permanent_message' | 'block_modules' | 'generate_tasks' | 'policy_terms';

export const FUNCTION_ACTIONS: { key: FunctionType; label: string }[] = [
  { key: 'permanent_message', label: 'Ingresar mensaje permanente' },
  { key: 'block_modules', label: 'Bloquear accesos al menú de módulos' },
  { key: 'generate_tasks', label: 'Generar tareas' },
  { key: 'policy_terms', label: 'Detalle de la política (términos y condiciones)' },
];
export const FUNCTION_LABEL: Record<FunctionType, string> =
  Object.fromEntries(FUNCTION_ACTIONS.map((a) => [a.key, a.label])) as any;
// Etiqueta corta para el nodo del grafo.
export const FUNCTION_SHORT: Record<FunctionType, string> = {
  permanent_message: 'Mensaje permanente',
  block_modules: 'Bloqueo de módulos',
  generate_tasks: 'Generar tareas',
  policy_terms: 'Detalle / Términos',
};

/**
 * Color y FORMA del nodo de cada tipo de función en el grafo. El "Detalle / Términos"
 * usa una forma de DOCUMENTO (distinta del pentágono) para diferenciarlo a simple vista.
 */
export const FUNCTION_TYPE_META: Record<FunctionType, { color: string; shape: 'pentagon' | 'doc' }> = {
  permanent_message: { color: '#22d3ee', shape: 'pentagon' },
  block_modules: { color: '#22d3ee', shape: 'pentagon' },
  generate_tasks: { color: '#22d3ee', shape: 'pentagon' },
  policy_terms: { color: '#f59e0b', shape: 'doc' }, // ámbar + documento
};

/** Módulos del /dashboard que una política puede BLOQUEAR (Admin nunca se bloquea). */
export const BLOCKABLE_MODULES: { path: string; label: string }[] = [
  { path: '/dashboard', label: 'Inicio' },
  { path: '/dashboard/mi-dia', label: 'Mi día' },
  { path: '/dashboard/experiencias', label: 'Experiencias' },
  { path: '/dashboard/tickets', label: 'Tickets' },
  { path: '/dashboard/projects', label: 'Proyectos' },
  { path: '/dashboard/clients', label: 'Clientes' },
  { path: '/dashboard/invoices', label: 'Facturas' },
  { path: '/dashboard/marketplace', label: 'Marketplace' },
  { path: '/dashboard/settings', label: 'Configuración' },
  { path: '/dashboard/support', label: 'Soporte' },
  { path: '/dashboard/subscriptions', label: 'Suscripciones' },
  { path: '/dashboard/centralized', label: 'Centralizado' },
  { path: '/dashboard/automatizaciones', label: 'Automatizaciones' },
  { path: '/dashboard/tools', label: 'Herramientas' },
];
export const MODULE_LABEL: Record<string, string> =
  Object.fromEntries(BLOCKABLE_MODULES.map((m) => [m.path, m.label]));

/* ── Config de cada función (guardada en cv_functions.config jsonb) ─────────── */
export interface PermanentMessageConfig { message: string }
export interface BlockModulesConfig { modules: string[] } // paths de BLOCKABLE_MODULES

/**
 * Programa de una tarea a generar cuando la política se active. El INICIO es SIEMPRE la
 * fecha de activación de la política (no se elige). Los campos de PRESENCIA se combinan:
 *  - `daysCount`: ventana/duración = fecha de activación + N días (define el fin/límite).
 *  - `weekdays`: días de la semana en que la tarea está presente dentro de la ventana
 *    (vacío = todos los días); actúa como la recurrencia dentro de la ventana.
 *  - `allDay`: si ocupa toda la jornada. Si NO, se usan `startTime`/`endTime`.
 * La generación real se aplica en la iteración de enforcement.
 */
export interface TaskProgram {
  /** Alcance: 'all' = la tarea se genera para TODOS los usuarios (miembros activos +
   *  candidatos aprobados) al activar la política; 'user'/undefined = para el usuario
   *  específico indicado por userKind/userId. */
  scope?: 'user' | 'all';
  userKind: 'candidate' | 'member';  // solo aplica cuando scope = 'user'
  userId: string;                    // "" cuando scope = 'all'
  userName: string;                  // "Todos los usuarios" cuando scope = 'all'
  title: string;
  detail: string;
  valores: string[];   // etiquetas de valores (keys de VALORES)
  talentos: string[];  // etiquetas de talentos
  daysCount: number;   // cantidad de días desde la activación (ventana; ≥1)
  weekdays: number[];  // días de la semana presentes dentro de la ventana (vacío = todos)
  allDay: boolean;     // ocupa toda la jornada
  startTime: string;   // 'HH:MM' — hora de inicio (cuando no es todo el día)
  endTime: string;     // 'HH:MM' — hora de fin (cuando no es todo el día)
}
export interface GenerateTasksConfig { tasks: TaskProgram[] }

/** Detalle textual de la política (términos y condiciones) que se muestra durante su
 *  activación y que luego puede compartirse a los usuarios. */
export interface PolicyTermsClause { title: string; text: string }
export interface PolicyTermsConfig { title: string; purpose: string; conduct: string; clauses: PolicyTermsClause[] }

export type FunctionConfig = PermanentMessageConfig | BlockModulesConfig | GenerateTasksConfig | PolicyTermsConfig | Record<string, never>;

/** Resumen legible de una función para el grafo/panel. */
export function summarizeFunction(type: FunctionType, config: any): string {
  if (type === 'permanent_message') return config?.message ? `“${String(config.message).slice(0, 60)}”` : 'Sin mensaje';
  if (type === 'block_modules') { const n = config?.modules?.length || 0; return n ? `${n} módulo(s) bloqueado(s)` : 'Sin módulos'; }
  if (type === 'generate_tasks') { const n = config?.tasks?.length || 0; return n ? `${n} tarea(s) programada(s)` : 'Sin tareas'; }
  if (type === 'policy_terms') { const n = config?.clauses?.length || 0; return n ? `${n} cláusula(s)` : (config?.purpose || config?.title ? 'Detalle definido' : 'Sin detalle'); }
  return '';
}

/* ── Grafo del category ─────────────────────────────────────────────────────── */
export interface PolicyGraphNode {
  key: string;                 // `${type}:${id}`
  type: PolicyNodeType;
  id: number;
  title: string;
  active?: boolean;            // políticas
  functionType?: FunctionType; // funciones
}
export interface PolicyGraphEdge { source: string; target: string }
export interface PolicyGraph { nodes: PolicyGraphNode[]; edges: PolicyGraphEdge[] }

export const policyKey = (type: PolicyNodeType, id: number | string) => `${type}:${id}`;

export interface Category { id: number; name: string; policy_count?: number }
