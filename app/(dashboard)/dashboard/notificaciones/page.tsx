'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, FolderKanban, Crown, ChevronRight, RefreshCw } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type Notif = {
  id: string;
  type: string;
  kind: 'participant' | 'responsible';
  title: string;
  project_id: number;
  href: string;
  invited_at: string | null;
};

function fmtFecha(s: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function NotificacionesPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      const d = await res.json();
      setItems(d.data || []);
    } catch { setItems([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-[20px] font-semibold text-digi-text inline-flex items-center gap-2" style={df}>
          <Bell className="w-5 h-5 text-accent" /> Notificaciones
        </h1>
        {items.length > 0 && (
          <span className="text-[11px] font-semibold text-white bg-accent rounded-full px-2 py-0.5" style={mf}>{items.length}</span>
        )}
        <button onClick={load} className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-digi-muted hover:text-accent transition-colors" style={mf}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      <div className="space-y-2 max-w-2xl">
        {loading && items.length === 0 ? (
          <p className="text-[12px] text-digi-muted text-center py-10" style={mf}>Cargando…</p>
        ) : items.length === 0 ? (
          <div className="bg-digi-card border border-digi-border rounded-xl py-14 text-center">
            <div className="w-12 h-12 rounded-xl bg-accent-light border border-accent/20 flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6 text-accent" />
            </div>
            <p className="text-sm font-medium text-digi-text" style={df}>Sin notificaciones</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>Cuando te inviten a un proyecto, aparecerá aquí.</p>
          </div>
        ) : (
          items.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              className="group flex items-center gap-3 rounded-lg border border-digi-border bg-digi-card p-3 hover:border-accent/50 hover:shadow-sm transition-all"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${n.kind === 'responsible' ? 'bg-amber-50 border border-amber-200' : 'bg-accent-light border border-accent/20'}`}>
                {n.kind === 'responsible' ? <Crown className="w-4 h-4 text-amber-500" /> : <FolderKanban className="w-4 h-4 text-accent" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-digi-text truncate" style={mf}>{n.title}</p>
                <p className="text-[11.5px] text-digi-muted" style={mf}>
                  {n.kind === 'responsible' ? 'Invitación a liderar el proyecto' : 'Invitación a participar en el proyecto'}
                  {n.invited_at ? ` · ${fmtFecha(n.invited_at)}` : ''}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-digi-muted group-hover:text-accent transition-colors shrink-0" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
