'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, FolderKanban, Crown, Ticket, ChevronRight, RefreshCw } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type Notif = {
  id: string;
  category: string; // 'ticket' | 'project_responsible' | 'project_participant' | …
  title: string;
  label: string;
  href: string;
  date: string | null;
};

const ICON: Record<string, { icon: typeof Bell; tint: string; bg: string }> = {
  ticket: { icon: Ticket, tint: 'text-sky-500', bg: 'bg-sky-50 border-sky-200' },
  project_responsible: { icon: Crown, tint: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' },
  project_participant: { icon: FolderKanban, tint: 'text-accent', bg: 'bg-accent-light border-accent/20' },
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
    <div className="flex flex-col h-[calc(100dvh-130px)]">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        {items.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-accent rounded-full px-2 py-0.5" style={mf}><Bell className="w-3 h-3" /> {items.length}</span>
        )}
        <button onClick={load} className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-digi-muted hover:text-accent transition-colors" style={mf}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[12px] text-digi-muted" style={mf}>Cargando…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 bg-digi-card border border-digi-border rounded-xl flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-accent-light border border-accent/20 flex items-center justify-center mb-3">
            <Bell className="w-6 h-6 text-accent" />
          </div>
          <p className="text-sm font-medium text-digi-text" style={df}>Sin notificaciones</p>
          <p className="text-[12px] text-digi-muted mt-1" style={mf}>Cuando te inviten a un proyecto, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {items.map((n) => {
            const meta = ICON[n.category] || { icon: Bell, tint: 'text-accent', bg: 'bg-accent-light border-accent/20' };
            const Ico = meta.icon;
            return (
              <Link
                key={n.id}
                href={n.href}
                className="group flex items-center gap-3 rounded-lg border border-digi-border bg-digi-card p-3.5 hover:border-accent/50 hover:shadow-sm transition-all"
              >
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${meta.bg}`}>
                  <Ico className={`w-4 h-4 ${meta.tint}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-digi-text truncate" style={mf}>{n.title}</p>
                  <p className="text-[11.5px] text-digi-muted" style={mf}>
                    {n.label}{n.date ? ` · ${fmtFecha(n.date)}` : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-digi-muted group-hover:text-accent transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
