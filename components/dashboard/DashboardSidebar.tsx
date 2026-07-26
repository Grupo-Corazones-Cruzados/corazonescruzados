'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import BrandLoader from '@/components/ui/BrandLoader';
import ModuleTutorialsModal from '@/components/dashboard/ModuleTutorialsModal';
import { accessRoleOf, canAccessModule, isPathBlocked, type AccessRole } from '@/lib/dashboard/access';
import { DASHBOARD_MODULES, MODULE_GROUPS } from '@/lib/dashboard/modules';
import { usePolicyEffects } from '@/components/providers/PolicyEffectsProvider';
import {
  Home, Ticket, FolderKanban, CalendarClock, Store, Users, ReceiptText, Network, Wrench,
  Settings, LifeBuoy, ShieldCheck, Workflow, Menu, ChevronsLeft, ChevronsRight,
  LogOut, Sun, Moon, CalendarDays, Bell, PartyPopper, BrainCircuit, AlarmClock, Info,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}
interface NavGroup { title: string; items: NavItem[]; }

// Etiqueta del rol efectivo (candidato/cliente/miembro/admin) para mostrar al usuario.
const ROLE_LABEL_ES: Record<AccessRole, string> = {
  candidate: 'Candidato',
  client: 'Cliente',
  member: 'Miembro',
  admin: 'Admin',
};

// Iconos por nombre: el catálogo de módulos (`lib/dashboard/modules.ts`) es data pura
// (también lo usan rutas de servidor), así que el componente resuelve el icono aquí.
const ICONS: Record<string, LucideIcon> = {
  Home, CalendarDays, PartyPopper, BrainCircuit, AlarmClock, Bell, Ticket, FolderKanban,
  CalendarClock, Users, ReceiptText, Store, Workflow, Wrench, Network, Settings,
  LifeBuoy, ShieldCheck,
};

// La visibilidad por rol se decide con `canAccessModule` (lib/dashboard/access.ts),
// la MISMA fuente de verdad que usa el guard de rutas. El orden y las etiquetas salen
// del catálogo compartido `DASHBOARD_MODULES`.
const NAV_GROUPS: NavGroup[] = MODULE_GROUPS.map((title) => ({
  title,
  items: DASHBOARD_MODULES
    .filter((m) => m.group === title)
    .map((m) => ({ label: m.label, href: m.href, icon: ICONS[m.icon] ?? Home })),
}));

const mf = { fontFamily: 'var(--font-body)' } as const;

export default function DashboardSidebar({
  dark = false,
  onToggleTheme,
  collapsed = false,
  onToggleCollapse,
}: {
  dark?: boolean;
  onToggleTheme?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Módulo cuyo modal de tutoriales está abierto (null = ninguno). Al cerrarlo el
  // modal se DESMONTA, así el iframe de YouTube deja de reproducir.
  const [tutorialFor, setTutorialFor] = useState<NavItem | null>(null);
  // Cuántos videos activos tiene cada módulo — solo para resaltar el botón ⓘ de los
  // módulos que ya tienen tutorial publicado.
  const [tutorialCounts, setTutorialCounts] = useState<Record<string, number>>({});

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch('/api/tutoriales?counts=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.data) setTutorialCounts(j.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user]);

  const accessRole = accessRoleOf(user);
  const { blockedModules } = usePolicyEffects();
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => canAccessModule(accessRole, it.href) && (accessRole === 'admin' || !isPathBlocked(it.href, blockedModules))) }))
    .filter((g) => g.items.length > 0);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-30 lg:hidden w-10 h-10 flex items-center justify-center rounded-lg border border-digi-border bg-digi-card text-accent shadow-sm hover:border-accent transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop */}
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 bg-digi-card border-r border-digi-border flex flex-col transition-all duration-200
          ${collapsed ? 'w-16' : 'w-56'}
          ${mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand */}
        <Link href="/" className={`flex items-center gap-2.5 h-14 border-b border-digi-border hover:bg-black/[0.02] transition-colors shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
          <BrandLoader size="sm" />
          {!collapsed && <span className="text-[14px] font-bold text-digi-text tracking-tight truncate" style={mf}>GCC WORLD</span>}
        </Link>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {groups.map((group, gi) => (
            <div key={group.title} className={gi > 0 ? 'mt-2' : ''}>
              {!collapsed ? (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-digi-muted/70 px-2.5 pt-2 pb-1" style={mf}>{group.title}</p>
              ) : gi > 0 ? (
                <div className="h-px bg-digi-border/60 mx-2 my-2" />
              ) : null}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const hasTutorials = (tutorialCounts[item.href] ?? 0) > 0;
                  return (
                    <div key={item.href} className="relative">
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`relative flex items-center gap-2.5 rounded-md py-2 text-[13px] font-medium transition-colors ${collapsed ? 'justify-center px-0' : 'pl-2.5 pr-9'} ${
                          active ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text hover:bg-black/[0.04]'
                        }`}
                        style={mf}
                      >
                        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />}
                        <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-accent' : ''}`} strokeWidth={2} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>

                      {/* Botón de información: abre los videos tutoriales del módulo.
                          Va al borde derecho del botón del módulo; se oculta con el
                          sidebar colapsado (no hay ancho). Se resalta si ya hay video. */}
                      {!collapsed && (
                        <button
                          type="button"
                          onClick={() => setTutorialFor(item)}
                          title={`Tutoriales de ${item.label}`}
                          aria-label={`Tutoriales de ${item.label}`}
                          className={`absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-accent-light hover:text-accent ${
                            hasTutorials ? 'text-accent' : 'text-digi-muted/40'
                          }`}
                        >
                          <Info className="w-[15px] h-[15px]" strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-digi-border p-2.5 shrink-0">
          {user && (
            <div className={`flex items-center gap-2.5 mb-2 ${collapsed ? 'justify-center' : ''}`}>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full border border-digi-border object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent-light border border-accent/20 text-accent text-[12px] font-semibold shrink-0" style={mf}>
                  {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-digi-text truncate" style={mf}>{user.first_name || user.email.split('@')[0]}</p>
                  <p className="text-[10px] text-digi-muted" style={mf}>{ROLE_LABEL_ES[accessRole]}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className={`flex items-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium text-digi-muted border border-digi-border hover:border-accent hover:text-accent transition-colors ${collapsed ? 'justify-center' : 'justify-center'}`}
                aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                title={dark ? 'Modo claro' : 'Modo oscuro'}
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {!collapsed && (dark ? 'Modo claro' : 'Modo oscuro')}
              </button>
            )}
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex items-center justify-center py-1.5 rounded-md text-digi-muted border border-digi-border hover:border-accent hover:text-accent transition-colors"
              aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
            </button>
            <button
              onClick={signOut}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors"
              style={mf}
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && 'Salir'}
            </button>
          </div>
        </div>
      </aside>

      {/* Modal de tutoriales del módulo (isla corp: el sidebar ya vive dentro de `.corp`) */}
      {tutorialFor && (
        <ModuleTutorialsModal
          module={tutorialFor.href}
          label={tutorialFor.label}
          onClose={() => setTutorialFor(null)}
        />
      )}
    </>
  );
}
