'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ChevronRight } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

// Etiquetas legibles por segmento de ruta (coinciden con el sidebar y subpáginas).
const LABELS: Record<string, string> = {
  dashboard: 'Inicio',
  tickets: 'Tickets', projects: 'Proyectos', subscriptions: 'Suscripciones', clients: 'Clientes',
  invoices: 'Facturas', marketplace: 'Marketplace', automatizaciones: 'Automatizaciones',
  tools: 'Herramientas', centralized: 'Centralizado', settings: 'Configuración', support: 'Soporte', admin: 'Admin',
  availability: 'Disponibilidad', cv: 'Mi CV', portfolio: 'Portafolio', calendar: 'Calendario',
  incidents: 'Incidentes', world: 'Mundo', sprites: 'Sprites', 'digimundo-projects': 'Proyectos',
};

function labelFor(seg: string): string {
  if (/^\d+$/.test(seg)) return `#${seg}`;
  if (seg.length >= 20) return 'Detalle'; // tokens/ids largos
  return LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
}

export default function DashboardBreadcrumb({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname() || '/dashboard';
  const segments = pathname.replace(/^\/+|\/+$/g, '').split('/'); // ['dashboard', ...]
  if (segments[0] !== 'dashboard') return null;

  const crumbs = segments.map((seg, i) => ({
    label: labelFor(seg),
    href: '/' + segments.slice(0, i + 1).join('/'),
  }));

  return (
    <nav
      aria-label="Ruta"
      className={`fixed bottom-0 right-0 left-0 z-20 h-9 flex items-center gap-1 px-4 border-t border-digi-border bg-digi-card/95 backdrop-blur overflow-x-auto whitespace-nowrap transition-[left] duration-200 ${
        collapsed ? 'lg:left-16' : 'lg:left-56'
      }`}
      style={mf}
    >
      <Home className="w-3.5 h-3.5 text-digi-muted shrink-0" />
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.href} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-digi-muted/60" />}
            {last ? (
              <span className="text-[12px] font-medium text-digi-text">{c.label}</span>
            ) : (
              <Link href={c.href} className="text-[12px] text-digi-muted hover:text-accent transition-colors">{c.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
