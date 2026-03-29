'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import BrandLoader from '@/components/ui/BrandLoader';

/*
 * Logo sprite sheet: /logo-spritesheet.png (1024×1024)
 * WALK row = row 1, 6 frames → each frame ≈ 170×165px
 * Display at 36px: scale = 36/170 ≈ 0.212
 * bg-size: 217px, y-offset for WALK row ≈ -35px, --sw: -217px
 */

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', href: '/dashboard', icon: '~' },
  { label: 'Tickets', href: '/dashboard/tickets', icon: '#' },
  { label: 'Proyectos', href: '/dashboard/projects', icon: '>' },
  { label: 'Marketplace', href: '/dashboard/marketplace', icon: '$' },
  { label: 'Facturas', href: '/dashboard/invoices', icon: '%' },
  { label: 'Configuracion', href: '/dashboard/settings', icon: '*' },
  { label: 'Soporte', href: '/dashboard/support', icon: '?' },
  { label: 'Admin', href: '/dashboard/admin', icon: '!', roles: ['admin'] },
];

export default function DashboardSidebar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user?.role || '')
  );

  const pf = { fontFamily: "'Silkscreen', cursive" } as const;

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 lg:hidden w-10 h-10 flex items-center justify-center border-2 border-digi-border bg-digi-card text-accent-glow hover:border-accent transition-colors"
        style={pf}
      >
        =
      </button>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 bg-digi-card border-r-2 border-digi-border flex flex-col transition-all duration-200
          ${collapsed ? 'w-16' : 'w-56'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 px-3 py-4 border-b-2 border-digi-border hover:bg-accent/5 transition-colors">
          <BrandLoader size="sm" />
          {!collapsed && (
            <span className="text-[10px] text-accent-glow truncate" style={pf}>
              GCC WORLD
            </span>
          )}
        </Link>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5">
          {visibleItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-2 my-0.5 text-[10px] transition-colors ${
                  active
                    ? 'bg-accent/15 border-l-2 border-accent text-accent-glow'
                    : 'border-l-2 border-transparent text-digi-muted hover:text-digi-text hover:bg-digi-border/30'
                }`}
                style={pf}
                title={collapsed ? item.label : undefined}
              >
                <span className="w-5 text-center text-xs shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t-2 border-digi-border p-2.5">
          {!collapsed && user && (
            <div className="flex items-center gap-2 mb-2">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-7 h-7 border border-accent/30 object-cover shrink-0" />
              ) : (
                <div
                  className="w-7 h-7 flex items-center justify-center bg-accent/20 border border-accent/30 text-accent-glow text-[9px] shrink-0"
                  style={pf}
                >
                  {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[9px] text-digi-text truncate" style={pf}>
                  {user.first_name || user.email.split('@')[0]}
                </p>
                <p className="text-[8px] text-accent-glow/60">{user.role}</p>
              </div>
            </div>
          )}

          <div className="flex gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex flex-1 items-center justify-center py-1.5 text-[9px] text-digi-muted border border-digi-border hover:border-accent hover:text-accent-glow transition-colors"
              style={pf}
            >
              {collapsed ? '>>' : '<<'}
            </button>
            <button
              onClick={signOut}
              className="flex-1 py-1.5 text-[9px] text-digi-muted border border-digi-border hover:border-red-500/50 hover:text-red-400 transition-colors"
              style={pf}
            >
              {collapsed ? 'X' : 'Salir'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
