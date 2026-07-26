/**
 * Catálogo de MÓDULOS del dashboard — fuente única de la lista de módulos.
 *
 * Lo usan: el sidebar (`components/dashboard/DashboardSidebar.tsx`, que le pone los
 * iconos), el panel de Tutoriales del admin (para elegir a qué módulo pertenece cada
 * video) y la API de tutoriales (para validar la clave de módulo).
 *
 * La CLAVE de un módulo es su `href` (p. ej. `/dashboard/tickets`) — el mismo
 * identificador que usa el control de acceso en `lib/dashboard/access.ts`, así no hay
 * un segundo juego de nombres que mantener sincronizado.
 *
 * Sin dependencias de React/lucide a propósito: este archivo lo importan también rutas
 * de servidor. El `icon` es el NOMBRE del icono de lucide; quien renderiza lo resuelve.
 */
export interface DashboardModule {
  /** Clave del módulo = su ruta base. */
  href: string;
  label: string;
  /** Grupo del sidebar. */
  group: 'Principal' | 'Operación' | 'Plataforma' | 'Sistema';
  /** Nombre del icono de `lucide-react`. */
  icon: string;
}

export const DASHBOARD_MODULES: DashboardModule[] = [
  { href: '/dashboard',                  label: 'Inicio',           group: 'Principal',  icon: 'Home' },
  { href: '/dashboard/mi-dia',           label: 'Mi día',           group: 'Principal',  icon: 'CalendarDays' },
  { href: '/dashboard/experiencias',     label: 'Experiencias',     group: 'Principal',  icon: 'PartyPopper' },
  { href: '/dashboard/pensamientos',     label: 'Pensamientos',     group: 'Principal',  icon: 'BrainCircuit' },
  { href: '/dashboard/recordatorios',    label: 'Recordatorios',    group: 'Principal',  icon: 'AlarmClock' },
  { href: '/dashboard/notificaciones',   label: 'Notificaciones',   group: 'Principal',  icon: 'Bell' },
  { href: '/dashboard/tickets',          label: 'Tickets',          group: 'Operación',  icon: 'Ticket' },
  { href: '/dashboard/projects',         label: 'Proyectos',        group: 'Operación',  icon: 'FolderKanban' },
  { href: '/dashboard/subscriptions',    label: 'Suscripciones',    group: 'Operación',  icon: 'CalendarClock' },
  { href: '/dashboard/clients',          label: 'Clientes',         group: 'Operación',  icon: 'Users' },
  { href: '/dashboard/invoices',         label: 'Facturas',         group: 'Operación',  icon: 'ReceiptText' },
  { href: '/dashboard/marketplace',      label: 'Marketplace',      group: 'Plataforma', icon: 'Store' },
  { href: '/dashboard/automatizaciones', label: 'Automatizaciones', group: 'Plataforma', icon: 'Workflow' },
  { href: '/dashboard/tools',            label: 'Herramientas',     group: 'Plataforma', icon: 'Wrench' },
  { href: '/dashboard/centralized',      label: 'Centralizado',     group: 'Plataforma', icon: 'Network' },
  { href: '/dashboard/settings',         label: 'Configuración',    group: 'Sistema',    icon: 'Settings' },
  { href: '/dashboard/support',          label: 'Soporte',          group: 'Sistema',    icon: 'LifeBuoy' },
  { href: '/dashboard/admin',            label: 'Admin',            group: 'Sistema',    icon: 'ShieldCheck' },
];

export const MODULE_GROUPS = ['Principal', 'Operación', 'Plataforma', 'Sistema'] as const;

/** ¿La clave corresponde a un módulo real del dashboard? */
export function isModuleKey(href: string): boolean {
  return DASHBOARD_MODULES.some((m) => m.href === href);
}

/** Etiqueta legible del módulo (o la propia clave si no se reconoce). */
export function moduleLabel(href: string): string {
  return DASHBOARD_MODULES.find((m) => m.href === href)?.label ?? href;
}
