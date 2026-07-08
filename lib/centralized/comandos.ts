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
export type FunctionType = 'permanent_message' | 'block_modules' | 'generate_tasks';

export const FUNCTION_ACTIONS: { key: FunctionType; label: string }[] = [
  { key: 'permanent_message', label: 'Ingresar mensaje permanente' },
  { key: 'block_modules', label: 'Bloquear accesos al menú de módulos' },
  { key: 'generate_tasks', label: 'Generar tareas' },
];
export const FUNCTION_LABEL: Record<FunctionType, string> =
  Object.fromEntries(FUNCTION_ACTIONS.map((a) => [a.key, a.label])) as any;
// Etiqueta corta para el nodo del grafo.
export const FUNCTION_SHORT: Record<FunctionType, string> = {
  permanent_message: 'Mensaje permanente',
  block_modules: 'Bloqueo de módulos',
  generate_tasks: 'Generar tareas',
};

/** Módulos del /dashboard que una política puede BLOQUEAR (Admin nunca se bloquea). */
export const BLOCKABLE_MODULES: { path: string; label: string }[] = [
  { path: '/dashboard', label: 'Inicio' },
  { path: '/dashboard/mi-dia', label: 'Mi día' },
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
 * Programa de una tarea a generar cuando la política se active. La semántica de
 * ejecución (fecha de activación como origen) se aplica en la iteración de enforcement.
 */
export interface TaskProgram {
  userKind: 'candidate' | 'member';
  userId: string;
  userName: string;
  title: string;
  detail: string;
  valores: string[];   // etiquetas de valores (keys de VALORES)
  talentos: string[];  // etiquetas de talentos
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  startWeekday: number | null;          // día de la semana de inicio (0=Dom … 6=Sáb), relativo a la activación
  spanMode: 'days' | 'weekdays' | 'allday';
  daysCount: number | null;             // spanMode='days': cantidad de días desde la fecha de inicio
  weekdays: number[];                   // spanMode='weekdays': días de la semana presentes
}
export interface GenerateTasksConfig { tasks: TaskProgram[] }

export type FunctionConfig = PermanentMessageConfig | BlockModulesConfig | GenerateTasksConfig | Record<string, never>;

/** Resumen legible de una función para el grafo/panel. */
export function summarizeFunction(type: FunctionType, config: any): string {
  if (type === 'permanent_message') return config?.message ? `“${String(config.message).slice(0, 60)}”` : 'Sin mensaje';
  if (type === 'block_modules') { const n = config?.modules?.length || 0; return n ? `${n} módulo(s) bloqueado(s)` : 'Sin módulos'; }
  if (type === 'generate_tasks') { const n = config?.tasks?.length || 0; return n ? `${n} tarea(s) programada(s)` : 'Sin tareas'; }
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
