'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { Bell, X, FolderKanban, Crown, Ticket, ChevronRight } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const POLL = 60000;

interface Notif {
  id: string;
  category: string;
  title: string;
  label: string;
  href: string;
  date: string | null;
  read?: boolean;
}

const ICON: Record<string, { Icon: typeof Bell; tint: string; bg: string }> = {
  ticket: { Icon: Ticket, tint: 'text-sky-500', bg: 'bg-sky-50 border-sky-200' },
  project_responsible: { Icon: Crown, tint: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' },
  project_participant: { Icon: FolderKanban, tint: 'text-accent', bg: 'bg-accent-light border-accent/20' },
};

function fmtFecha(s: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Campanita de notificaciones: **el ancla de la esquina inferior derecha**. Va siempre en
 * `right-3/4` y el resto del muelle se coloca a su izquierda midiéndola — `ChatDock` lee
 * `[data-notifications-dock]` y `GccBotChat` lee `[data-chatdock-launchers]`, así que la
 * fila queda: GCC Bot · Chat · Mis chats · 🔔.
 *
 * Sustituye al antiguo módulo `/dashboard/notificaciones`: la lista completa se ve aquí,
 * en una ventana flotante con scroll propio y de la más reciente a la más antigua.
 *
 * El contador muestra las NO leídas y **desaparece del todo cuando no hay** (nunca pone
 * "0"); el botón sigue funcionando igual. Abrir la ventana marca todo como leído.
 */
export default function NotificationsDock() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const j = await res.json();
      setItems(j.data || []);
      setUnread(j.unread ?? 0);
    } catch { /* un fallo puntual no debe romper el muelle */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (id) clearInterval(id); id = setInterval(load, POLL); };
    const onVis = () => {
      if (document.hidden) { if (id) { clearInterval(id); id = null; } }
      else { load(); start(); }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => { if (id) clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [user, load]);

  // Abrir = leer: se apaga el contador al instante (sin esperar al servidor) y se
  // persiste; si la petición falla, el próximo sondeo lo devuelve a su sitio.
  const toggle = async () => {
    const abriendo = !open;
    setOpen(abriendo);
    if (!abriendo || unread === 0) return;
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try { await fetch('/api/notifications', { method: 'POST' }); } catch { /* reintenta el sondeo */ }
  };

  // Cerrar con Escape o al pulsar fuera de la ventana.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  if (!user) return null;

  return (
    <div
      ref={boxRef}
      data-notifications-dock
      className="fixed bottom-11 right-3 lg:right-4 z-[95] flex flex-col items-end"
      style={mf}
    >
      {open && (
        <div className="mb-2 w-[min(92vw,360px)] rounded-xl border border-digi-border bg-digi-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-digi-border">
            <Bell className="w-4 h-4 text-accent" />
            <span className="text-[13px] font-semibold text-digi-text flex-1">Notificaciones</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar notificaciones"
              className="w-7 h-7 flex items-center justify-center rounded-md text-digi-muted hover:text-digi-text hover:bg-black/[0.05] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scroll PROPIO de la ventana: la lista completa, de la más reciente a la más antigua */}
          <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            {loading ? (
              <p className="text-[12px] text-digi-muted text-center py-8">Cargando…</p>
            ) : items.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center mx-auto mb-2">
                  <Bell className="w-5 h-5 text-accent" />
                </div>
                <p className="text-[12.5px] font-semibold text-digi-text">Sin notificaciones</p>
                <p className="text-[11.5px] text-digi-muted mt-1">Aquí aparecerán tus avisos e invitaciones.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {items.map((n) => {
                  const meta = ICON[n.category] || { Icon: Bell, tint: 'text-digi-muted', bg: 'bg-black/[0.03] border-digi-border' };
                  const contenido = (
                    <>
                      <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${meta.bg}`}>
                        <meta.Icon className={`w-4 h-4 ${meta.tint}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-medium text-digi-text truncate">{n.title}</span>
                        {n.label && <span className="block text-[11.5px] text-digi-muted line-clamp-2">{n.label}</span>}
                        <span className="block text-[10.5px] text-digi-muted/70 mt-0.5">{fmtFecha(n.date)}</span>
                      </span>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1" aria-label="No leída" />}
                      {n.href && n.href !== '#' && <ChevronRight className="w-3.5 h-3.5 text-digi-muted/50 shrink-0" />}
                    </>
                  );
                  const cls = 'flex items-start gap-2.5 rounded-lg border border-transparent p-2 hover:border-accent/40 hover:bg-accent-light transition-colors';
                  return n.href && n.href !== '#' ? (
                    <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className={cls}>{contenido}</Link>
                  ) : (
                    <div key={n.id} className={cls}>{contenido}</div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={toggle}
        aria-label={open ? 'Cerrar notificaciones' : `Abrir notificaciones${unread ? `, ${unread} sin leer` : ''}`}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-colors ${
          open ? 'bg-accent-hover text-white' : 'bg-accent text-white hover:bg-accent-hover'
        }`}
      >
        {open ? <X className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        {/* El contador solo existe si hay algo sin leer; nunca se muestra un "0". */}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold tabular-nums border-2 border-digi-card">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
