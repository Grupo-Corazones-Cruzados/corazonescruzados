'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import BrandLoader from '@/components/ui/BrandLoader';
import {
  Home, Ticket, FolderKanban, CalendarClock, Store, Users, ReceiptText, Network, Wrench,
  Settings, LifeBuoy, ShieldCheck, Workflow, Menu, ChevronsLeft, ChevronsRight,
  LogOut, Sun, Moon, type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
}
interface NavGroup { title: string; items: NavItem[]; }

// Cliente (rol 'client') ve SOLO: Marketplace, Tickets, Proyectos, Suscripciones,
// Automatizaciones, Configuracion y Soporte. El resto queda a member/admin.
const NAV_GROUPS: NavGroup[] = [
  { title: 'Principal', items: [
    { label: 'Inicio', href: '/dashboard', icon: Home, roles: ['member', 'admin'] },
  ] },
  { title: 'Operación', items: [
    { label: 'Tickets', href: '/dashboard/tickets', icon: Ticket },
    { label: 'Proyectos', href: '/dashboard/projects', icon: FolderKanban },
    { label: 'Suscripciones', href: '/dashboard/subscriptions', icon: CalendarClock, roles: ['member', 'admin', 'client'] },
    { label: 'Clientes', href: '/dashboard/clients', icon: Users, roles: ['member', 'admin'] },
    { label: 'Facturas', href: '/dashboard/invoices', icon: ReceiptText, roles: ['member', 'admin'] },
  ] },
  { title: 'Plataforma', items: [
    { label: 'Marketplace', href: '/dashboard/marketplace', icon: Store },
    { label: 'Automatizaciones', href: '/dashboard/automatizaciones', icon: Workflow },
    { label: 'Herramientas', href: '/dashboard/tools', icon: Wrench, roles: ['member', 'admin'] },
    { label: 'Centralizado', href: '/dashboard/centralized', icon: Network, roles: ['member', 'admin'] },
  ] },
  { title: 'Sistema', items: [
    { label: 'Configuración', href: '/dashboard/settings', icon: Settings },
    { label: 'Soporte', href: '/dashboard/support', icon: LifeBuoy },
    { label: 'Admin', href: '/dashboard/admin', icon: ShieldCheck, roles: ['admin'] },
  ] },
];

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

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const role = user?.role || '';
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.roles || it.roles.includes(role)) }))
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
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`relative flex items-center gap-2.5 rounded-md py-2 text-[13px] font-medium transition-colors ${collapsed ? 'justify-center px-0' : 'px-2.5'} ${
                        active ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text hover:bg-black/[0.04]'
                      }`}
                      style={mf}
                    >
                      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />}
                      <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-accent' : ''}`} strokeWidth={2} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
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
                  <p className="text-[10px] text-digi-muted capitalize" style={mf}>{user.role}</p>
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
    </>
  );
}
