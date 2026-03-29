'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import PixelBadge from '@/components/ui/PixelBadge';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  member: 'Miembro',
  client: 'Cliente',
};

const ROLE_VARIANTS: Record<string, 'info' | 'success' | 'default'> = {
  admin: 'info',
  member: 'success',
  client: 'default',
};

interface Stats {
  open_tickets: number;
  active_projects: number;
  users?: number;
  active_members?: number;
  clients?: number;
}

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const greeting = user?.first_name ? `Hola, ${user.first_name}` : 'Bienvenido';

  return (
    <div className="max-w-4xl">
      {/* Welcome */}
      <div className="flex items-center gap-3 mb-8">
        <div>
          <h1 className="pixel-heading text-xl text-white">{greeting}</h1>
          <p className="text-xs text-digi-muted mt-1" style={mf}>
            Panel de control de GCC World
          </p>
        </div>
        {user?.role && (
          <PixelBadge variant={ROLE_VARIANTS[user.role] || 'default'}>
            {ROLE_LABELS[user.role] || user.role}
          </PixelBadge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <StatCard label="Tickets Abiertos" value={stats?.open_tickets} href="/dashboard/tickets" />
        <StatCard label="Proyectos Activos" value={stats?.active_projects} href="/dashboard/projects" />
        {user?.role === 'admin' && (
          <>
            <StatCard label="Usuarios" value={stats?.users} href="/dashboard/admin" />
            <StatCard label="Miembros" value={stats?.active_members} />
            <StatCard label="Clientes" value={stats?.clients} />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <h2 className="pixel-heading text-sm text-white mb-3">Acciones Rapidas</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ActionCard label="Nuevo Ticket" href="/dashboard/tickets" icon="#" />
        <ActionCard label="Nuevo Proyecto" href="/dashboard/projects" icon=">" />
        <ActionCard label="Marketplace" href="/dashboard/marketplace" icon="$" />
        <ActionCard label="Configuracion" href="/dashboard/settings" icon="*" />
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value?: number; href?: string }) {
  const content = (
    <div className="pixel-card py-4 px-4">
      <p className="text-[9px] text-digi-muted mb-2" style={pf}>{label}</p>
      {value !== undefined ? (
        <p className="text-2xl text-white font-bold" style={mf}>{value}</p>
      ) : (
        <div className="h-8 w-12 bg-digi-border/30 animate-pulse" />
      )}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function ActionCard({ label, href, icon }: { label: string; href: string; icon: string }) {
  return (
    <Link href={href}>
      <div className="pixel-card py-4 px-3 text-center hover:border-accent group">
        <span className="text-xl text-accent-glow group-hover:scale-110 inline-block transition-transform" style={pf}>
          {icon}
        </span>
        <p className="text-[9px] text-digi-muted mt-2 group-hover:text-digi-text transition-colors" style={pf}>
          {label}
        </p>
      </div>
    </Link>
  );
}
