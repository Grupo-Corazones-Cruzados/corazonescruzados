import type { User } from '@/lib/types';

/**
 * Accesos ESTÁTICOS por rol al dashboard. Fuente única de verdad: la usan el
 * sidebar (qué módulos se muestran) y el guard de rutas (a qué puede navegar).
 *
 * Roles efectivos:
 *  - admin    → todo, sin restricción.
 *  - member   → todo excepto Admin.
 *  - candidate→ postulante (role='client' + clients.account_type='candidate').
 *  - client   → cliente (role='client', account_type distinto de 'candidate').
 *
 * Matriz definida por el usuario (2026-07-06):
 *  Inicio          → candidate, member, admin
 *  Tickets         → todos
 *  Proyectos       → todos
 *  Clientes        → candidate, member, admin
 *  Facturas        → candidate, member, admin
 *  Marketplace     → todos
 *  Configuración   → todos
 *  Soporte         → todos
 *  Suscripciones   → client, member, admin
 *  Centralizado    → member, admin
 *  Automatizaciones→ member, admin
 *  Herramientas    → member, admin
 *  Admin           → admin
 */
export type AccessRole = 'candidate' | 'client' | 'member' | 'admin';

const ALL: AccessRole[] = ['candidate', 'client', 'member', 'admin'];

/** Reglas por módulo (base path → roles permitidos). Admin siempre pasa. */
export const MODULE_ACCESS: { path: string; roles: AccessRole[] }[] = [
  { path: '/dashboard', roles: ['candidate', 'member', 'admin'] }, // Inicio (exacto)
  { path: '/dashboard/tickets', roles: ALL },
  { path: '/dashboard/projects', roles: ALL },
  { path: '/dashboard/clients', roles: ['candidate', 'member', 'admin'] },
  { path: '/dashboard/invoices', roles: ['candidate', 'member', 'admin'] },
  { path: '/dashboard/marketplace', roles: ALL },
  { path: '/dashboard/settings', roles: ALL },
  { path: '/dashboard/support', roles: ALL },
  { path: '/dashboard/subscriptions', roles: ['client', 'member', 'admin'] },
  { path: '/dashboard/centralized', roles: ['member', 'admin'] },
  { path: '/dashboard/automatizaciones', roles: ['member', 'admin'] },
  { path: '/dashboard/tools', roles: ['member', 'admin'] },
  { path: '/dashboard/admin', roles: ['admin'] },
];

/** Rol efectivo de acceso a partir del usuario del dashboard. */
export function accessRoleOf(user: Pick<User, 'role' | 'account_type'> | null | undefined): AccessRole {
  if (!user) return 'client';
  if (user.role === 'admin') return 'admin';
  if (user.role === 'member') return 'member';
  // role === 'client': candidato o cliente según account_type.
  return user.account_type === 'candidate' ? 'candidate' : 'client';
}

/** Regla que aplica a una ruta (match exacto de Inicio o por prefijo del módulo). */
function ruleFor(pathname: string) {
  if (pathname === '/dashboard') return MODULE_ACCESS.find((m) => m.path === '/dashboard');
  return MODULE_ACCESS
    .filter((m) => m.path !== '/dashboard' && (pathname === m.path || pathname.startsWith(m.path + '/')))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

/** ¿El rol puede acceder a la ruta? Rutas sin regla conocida se permiten (no bloquear). */
export function canAccess(role: AccessRole, pathname: string): boolean {
  if (role === 'admin') return true;
  const rule = ruleFor(pathname);
  if (!rule) return true;
  return rule.roles.includes(role);
}

/** ¿Se muestra el módulo (por su href) a este rol? */
export function canAccessModule(role: AccessRole, href: string): boolean {
  return canAccess(role, href);
}

/** Página de aterrizaje válida para el rol (los clientes no tienen Inicio). */
export function defaultDashboardPath(role: AccessRole): string {
  if (canAccess(role, '/dashboard')) return '/dashboard';
  return '/dashboard/marketplace';
}
