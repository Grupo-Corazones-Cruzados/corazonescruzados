'use client';

/**
 * COMPARTIR EL CV — panel lateral derecho con overlay, abierto desde el botón
 * «Compartir CV» de la barra de pestañas de Configuración.
 *
 * ── ES EL MISMO DISEÑO QUE «COMPARTIR ACCESO» DE UNA COTIZACIÓN ───────────────
 * Lo pidió Fernando (2026-08-14) señalando esa pantalla: `PixelModal` con vigencia
 * del enlace arriba, la acción debajo y el enlace generado al pie. Mismas opciones
 * de duración que `QuoteShareButton`, para que compartir signifique lo mismo en toda
 * la app.
 *
 * ── LO QUE NO SE COPIÓ, Y POR QUÉ ─────────────────────────────────────────────
 * El de cotizaciones envía el enlace por correo al cliente, que ahí es un dato del
 * proyecto. Un CV no tiene destinatario guardado en ninguna parte: se comparte con
 * quien haga falta, y pedir un correo obligaría a teclearlo cada vez para hacer lo
 * que el botón «Copiar» ya resuelve.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { Check, Copy, ExternalLink, Link2, RefreshCw, Trash2 } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/** Las mismas que el enlace de una cotización, más «sin caducidad». */
const VIGENCIAS = [
  { v: 24, l: '1 día' },
  { v: 168, l: '1 semana' },
  { v: 720, l: '1 mes' },
  { v: 2160, l: '3 meses' },
  { v: 0, l: 'Sin caducidad' },
];

export default function PanelCompartirCv({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [caduca, setCaduca] = useState<string | null>(null);
  const [horas, setHoras] = useState(168);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [confirmar, setConfirmar] = useState<'regenerar' | 'revocar' | null>(null);

  // Se recarga cada vez que se abre: el enlace pudo revocarse desde otra pestaña.
  useEffect(() => {
    if (!open) return;
    setCargando(true);
    fetch('/api/members/cv/public-link')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setToken(d?.token ?? null); setCaduca(d?.expires_at ?? null); })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [open]);

  // El origen se lee en el navegador: el enlace copiado es el del sitio desde el que
  // se está trabajando, sin configurar nada.
  const url = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/cv/${token}` : '';

  const generar = async () => {
    setOcupado(true);
    try {
      const res = await fetch('/api/members/cv/public-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationHours: horas }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setToken(d.token);
      setCaduca(d.expires_at ?? null);
      toast.success(token ? 'Enlace regenerado. El anterior ya no funciona.' : 'Enlace creado');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo generar el enlace');
    } finally { setOcupado(false); setConfirmar(null); }
  };

  const revocar = async () => {
    setOcupado(true);
    try {
      const res = await fetch('/api/members/cv/public-link', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setToken(null); setCaduca(null);
      toast.success('Enlace revocado');
    } catch { toast.error('No se pudo revocar el enlace'); }
    finally { setOcupado(false); setConfirmar(null); }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch { toast.error('No se pudo copiar'); }
  };

  const fechaCaducidad = caduca
    ? new Date(caduca).toLocaleString('es-EC', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <PixelModal open={open} onClose={onClose} title="Compartir mi CV">
      <div className="space-y-3">
        <p className="text-[12px] text-digi-muted" style={mf}>
          Genera un enlace de <strong>solo lectura</strong> para alguien <strong>sin cuenta</strong> —una
          empresa de selección—: verá tu CV completo, tu portafolio, tu disponibilidad y tu
          aspiración salarial, y podrá descargarlo en PDF.
        </p>

        <div className="flex flex-col gap-1">
          <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Vigencia del enlace</label>
          <select value={horas} onChange={(e) => setHoras(Number(e.target.value))}
            className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf}>
            {VIGENCIAS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
          </select>
        </div>

        {cargando ? (
          <div className="h-9 rounded bg-black/[0.04] animate-pulse" />
        ) : !token ? (
          <button type="button" onClick={generar} disabled={ocupado} className={`${BTN_PRIMARY} w-full`}>
            <Link2 className="w-4 h-4" /> {ocupado ? 'Generando…' : 'Generar enlace'}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button type="button" onClick={generar} disabled={ocupado} className={`${BTN_SECONDARY} flex-1`}>
                <RefreshCw className="w-4 h-4" /> Regenerar con esta vigencia
              </button>
            </div>

            <div className="pt-2 border-t border-digi-border">
              <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Enlace</label>
              <div className="flex gap-2 mt-1">
                <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
                  className="field-control flex-1 min-w-0 px-3 py-2 bg-digi-darker border-2 border-digi-border text-[12px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                <button type="button" onClick={copiar} title="Copiar" className={BTN_SECONDARY}>
                  {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
                <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir" className={BTN_SECONDARY}>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <p className="mt-2 text-[11.5px] text-digi-muted" style={mf}>
                {fechaCaducidad ? <>Caduca el <strong>{fechaCaducidad}</strong>.</> : 'Sin caducidad: seguirá activo hasta que lo revoques.'}
              </p>
            </div>

            <button type="button" onClick={() => setConfirmar('revocar')} disabled={ocupado}
              className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 border border-digi-border rounded text-sm font-medium text-digi-muted hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50" style={mf}>
              <Trash2 className="w-4 h-4" /> Revocar el enlace
            </button>
          </div>
        )}
      </div>

      <PixelConfirm
        open={confirmar === 'revocar'}
        title="Revocar el enlace"
        message="Tu CV público dejará de estar accesible al instante, y también su PDF. Puedes generar un enlace nuevo cuando quieras."
        confirmLabel="Sí, revocar"
        danger
        onConfirm={revocar}
        onCancel={() => setConfirmar(null)}
      />
    </PixelModal>
  );
}
