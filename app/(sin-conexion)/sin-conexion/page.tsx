'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, CloudOff, Cloud, RefreshCw, Ticket, FolderKanban } from 'lucide-react';
import ListaSinConexion, { type TipoSinConexion } from '@/components/sin-conexion/ListaSinConexion';
import { sincronizar, catalogosGuardados } from '@/lib/borradores/sincronizar';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/**
 * SIN CONEXIÓN — LA PANTALLA QUE ABRE LA APP SIN RED (2026-10-07). Desde 2026-10-16 ya no es un
 * módulo «Borradores» aparte: es el estado «Sin conexión» de Tickets y de Proyectos, y aquí se
 * elige cuál de los dos se ve (`?de=proyectos` cuando la navegación que falló era de Proyectos).
 *
 * Vive fuera del panel a propósito (ver `../layout.tsx`): el panel arranca comprobando la
 * sesión con el servidor. El service worker (`public/sw.js`) la guarda y lleva aquí cualquier
 * navegación que falle por falta de red. Con red, la misma lista está en la pestaña «Sin
 * conexión» de cada módulo.
 */
export default function SinConexionPage() {
  const [tipo, setTipo] = useState<TipoSinConexion>('ticket');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('de') === 'proyectos') setTipo('proyecto');
  }, []);
  const [enLinea, setEnLinea] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [leidoEn, setLeidoEn] = useState<string | null>(null);

  const sync = useCallback(async (manual = false) => {
    if (!navigator.onLine) { setEnLinea(false); if (manual) toast.error('Sin conexión: se sincronizará al volver la red'); return; }
    setSincronizando(true);
    const r = await sincronizar();
    setSincronizando(false);
    // El navegador puede creer que hay red sin que el servidor responda (wifi sin internet,
    // servidor caído): lo que dice si hay conexión es si la sincronización llegó.
    setEnLinea(r.ok || r.motivo === 'sin-sesion');
    if (r.ok) {
      if (r.subidos) toast.success(r.subidos === 1 ? 'Se subió 1 borrador' : `Se subieron ${r.subidos} borradores`);
      if (r.conflictos) toast.warning('Hay borradores que cambiaron en la plataforma: elige con cuál quedarte');
    } else if (manual) {
      toast.error(r.motivo === 'sin-sesion' ? 'Entra en GCC World para sincronizar' : 'No se pudo sincronizar');
    }
    catalogosGuardados().then((c) => setLeidoEn(c?.leidoEn ?? null));
  }, []);

  useEffect(() => {
    setEnLinea(navigator.onLine);
    catalogosGuardados().then((c) => setLeidoEn(c?.leidoEn ?? null));
    sync();
    const on = () => { setEnLinea(true); sync(); };
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [sync]);

  return (
    <div className="min-h-screen flex flex-col pt-[var(--seguro-arriba)] pb-[var(--seguro-abajo)]">
      <header className="rail shrink-0 h-14 flex items-center gap-2 px-2 bg-digi-card border-b border-digi-border">
        {enLinea ? (
          <a href={tipo === 'ticket' ? '/dashboard/tickets' : '/dashboard/projects'} aria-label="Volver a la plataforma" className="w-11 h-11 flex items-center justify-center rounded-lg text-digi-text">
            <ChevronLeft className="w-6 h-6" />
          </a>
        ) : <span className="w-2" />}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-digi-text truncate leading-tight" style={df}>{tipo === 'ticket' ? 'Tickets' : 'Proyectos'}</p>
          <p className="text-[11.5px] text-digi-muted leading-tight" style={mf}>Sin conexión</p>
        </div>
        <span className={`inline-flex items-center gap-1 text-[11.5px] px-2 py-1 rounded-full ${enLinea ? 'text-emerald-700 bg-emerald-500/10' : 'text-digi-muted bg-black/5'}`} style={mf}>
          {enLinea ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
          {enLinea ? 'Con conexión' : 'Sin conexión'}
        </span>
        <button onClick={() => sync(true)} disabled={sincronizando} aria-label="Sincronizar"
          className="w-11 h-11 flex items-center justify-center rounded-lg text-digi-text disabled:opacity-40">
          <RefreshCw className={`w-5 h-5 ${sincronizando ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 space-y-3">
        {leidoEn && (
          <p className="text-[11.5px] text-digi-muted" style={mf}>
            Clientes y servicios guardados el {new Date(leidoEn).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
        <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-black/5">
          {([['ticket', 'Tickets', Ticket], ['proyecto', 'Proyectos', FolderKanban]] as const).map(([v, label, Icon]) => (
            <button key={v} role="tab" aria-selected={tipo === v} onClick={() => setTipo(v)}
              className={`h-10 inline-flex items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors ${tipo === v ? 'bg-digi-card text-accent shadow-sm' : 'text-digi-muted'}`} style={mf}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        <ListaSinConexion key={tipo} tipo={tipo} enLinea={enLinea} permitirNuevo />
      </main>
    </div>
  );
}
