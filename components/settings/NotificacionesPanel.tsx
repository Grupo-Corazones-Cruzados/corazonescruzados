'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { XCircle } from 'lucide-react';
import Interruptor from '@/components/ui/Interruptor';
import BotonAvisosPush from '@/components/calendar/BotonAvisosPush';
import type { Canal, DefinicionAviso } from '@/lib/avisos/catalogo';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const COLUMNAS: { canal: Canal; titulo: string }[] = [
  { canal: 'push', titulo: 'Notificación' },
  { canal: 'campana', titulo: 'Campanita' },
];

/**
 * Configuración → Notificaciones (Fernando, 2026-10-29): *«que yo elija qué recibo»*. Cada aviso
 * del catálogo (`lib/avisos/catalogo.ts`) que la persona puede recibir, agrupado por módulo, con
 * un interruptor por canal: «Notificación» (teléfono, Mac y navegador) y «Campanita». Todo sale
 * encendido; se guarda al tocar.
 *
 * Arriba, el botón para activar las notificaciones en ESTE navegador (el mismo de Mi día); en la
 * app nativa no sale porque allí llegan solas.
 */
export default function NotificacionesPanel() {
  const [avisos, setAvisos] = useState<DefinicionAviso[] | null>(null);
  const [valores, setValores] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/avisos/preferencias');
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Error');
        setAvisos(j.data.avisos);
        setValores(j.data.valores);
      } catch (e: any) { setErr(e.message); }
    })();
  }, []);

  const grupos = useMemo(() => {
    const m = new Map<string, DefinicionAviso[]>();
    for (const a of avisos || []) m.set(a.grupo, [...(m.get(a.grupo) || []), a]);
    return [...m.entries()];
  }, [avisos]);

  const cambiar = async (a: DefinicionAviso, canal: Canal, activo: boolean) => {
    const clave = `${a.clase}:${canal}`;
    setValores((v) => ({ ...v, [clave]: activo }));
    try {
      const r = await fetch('/api/avisos/preferencias', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clase: a.clase, canal, activo }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo guardar.');
    } catch (e: any) {
      setValores((v) => ({ ...v, [clave]: !activo }));
      toast.error(e.message);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 max-lg:p-0">
      {err && (
        <div className="mb-3 px-3 py-2 rounded-md border border-red-400/40 bg-red-500/10 text-[12px] text-red-600 flex items-center gap-2" style={mf}>
          <XCircle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      {/* A todo el ancho: los interruptores y «Avisos activos» quedan en el borde derecho (Fernando, 2026-10-29). */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 bg-digi-card border border-digi-border rounded-lg px-4 py-3 [&:not(:has(button))]:hidden">
          <p className="text-[13.5px] font-semibold text-digi-text" style={df}>Este navegador</p>
          <BotonAvisosPush />
        </div>

        {!avisos && !err && <p className="text-[12.5px] text-digi-muted px-1" style={mf}>Cargando…</p>}

        {grupos.map(([grupo, lista]) => (
          <section key={grupo} className="bg-digi-card border border-digi-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_76px_64px] sm:grid-cols-[minmax(0,1fr)_88px_88px] items-center px-3 sm:px-4 py-2.5 border-b border-digi-border bg-black/[0.02]">
              <h3 className="text-[13.5px] font-semibold text-digi-text" style={df}>{grupo}</h3>
              {COLUMNAS.map((c) => (
                <span key={c.canal} className="text-[10px] sm:text-[10.5px] uppercase sm:tracking-wide text-digi-muted text-center" style={mf}>{c.titulo}</span>
              ))}
            </div>
            <ul className="divide-y divide-digi-border">
              {lista.map((a) => (
                <li key={a.clase} className="grid grid-cols-[minmax(0,1fr)_76px_64px] sm:grid-cols-[minmax(0,1fr)_88px_88px] items-center px-3 sm:px-4 py-3 min-h-[48px]">
                  <span className="text-[13px] text-digi-text pr-2" style={mf}>{a.nombre}</span>
                  {COLUMNAS.map((c) => (
                    <span key={c.canal} className="flex justify-center">
                      {a.canales.includes(c.canal) && (
                        <Interruptor
                          activo={valores[`${a.clase}:${c.canal}`] ?? true}
                          onChange={(v) => cambiar(a, c.canal, v)}
                          etiqueta={`${a.nombre} · ${c.titulo}`}
                          className="destino-tactil"
                        />
                      )}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
