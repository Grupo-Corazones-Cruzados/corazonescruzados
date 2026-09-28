'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { Copy, Send } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

export type Duracion = { v: number; l: string };

/**
 * COMPARTIR UN ENLACE CON TOKEN — definición ÚNICA del formulario (2026-09-28).
 *
 * Nació en «Compartir acceso a la cotización» y Fernando lo pidió igual para cobrar un
 * proyecto: vigencia arriba, el correo del cliente, y dos botones — «Generar enlace» (para
 * copiarlo y mandarlo uno mismo) y «Generar y enviar» (sale el correo). Debajo, el enlace
 * con su botón de copiar.
 *
 * ⚠️ Antes había tres versiones parecidas (la de la cotización en panel, y dos ventanitas
 * centradas para el enlace de pago de proyecto y de ticket). Parecido no es igual: la
 * próxima mejora habría caído en una sola. Por eso quien lo usa solo pone el título, el
 * texto de arriba, lo que va entre medias (`children`) y la llamada al servidor.
 *
 * `generar` devuelve la URL y el mensaje del aviso, o lanza con el error del servidor.
 */
export default function PanelCompartirEnlace({
  open, onClose, title, intro, duraciones, duracionInicial, correoInicial = '',
  etiquetaCorreo = 'Correo del cliente (para enviarlo)', aviso, generar, children, pie, puedeGenerar = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro: React.ReactNode;
  duraciones: Duracion[];
  duracionInicial: number;
  correoInicial?: string;
  etiquetaCorreo?: string;
  /** Texto bajo el enlace generado (p. ej. «cualquiera con este enlace puede pagar»). */
  aviso?: React.ReactNode;
  generar: (o: { horas: number; email?: string; enviar: boolean }) => Promise<{ url: string; mensaje: string; ok?: boolean }>;
  /** Encima de la vigencia (p. ej. elegir la etapa). */
  children?: React.ReactNode;
  /** Debajo del último campo, antes de los botones: el importe (regla de `EditAmount`). */
  pie?: React.ReactNode;
  puedeGenerar?: boolean;
}) {
  const [email, setEmail] = useState(correoInicial);
  const [horas, setHoras] = useState(duracionInicial);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');

  // Cada vez que se abre, arranca limpio: un enlace de la vez anterior al pie se tomaría
  // por el de ahora, y puede ser de otra etapa.
  useEffect(() => {
    if (!open) return;
    setEmail(correoInicial);
    setHoras(duracionInicial);
    setUrl('');
  }, [open, correoInicial, duracionInicial]);

  const lanzar = async (enviar: boolean) => {
    if (enviar && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error('Ingresa un correo válido'); return; }
    setBusy(true);
    try {
      const r = await generar({ horas, email: email.trim() || undefined, enviar });
      setUrl(r.url);
      // `ok: false` = el enlace existe pero el correo no salió: se avisa sin tapar el enlace.
      (r.ok === false ? toast.warning : toast.success)(r.mensaje);
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setBusy(false); }
  };
  const copiar = () => { if (url) { navigator.clipboard.writeText(url); toast.success('Enlace copiado'); } };

  return (
    <PixelModal open={open} onClose={onClose} title={title} busy={busy}>
      <div className="space-y-3">
        <p className="text-[12px] text-digi-muted" style={mf}>{intro}</p>

        {children}

        <div className="flex flex-col gap-1">
          <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Vigencia del enlace</label>
          <select value={horas} onChange={(e) => setHoras(Number(e.target.value))}
            className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf}>
            {duraciones.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
          </select>
        </div>

        <PixelInput label={etiquetaCorreo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@correo.com" />

        {pie}

        <div className="flex gap-2">
          <button onClick={() => lanzar(false)} disabled={busy || !puedeGenerar} className={`${BTN_SECONDARY} flex-1`}>Generar enlace</button>
          <button onClick={() => lanzar(true)} disabled={busy || !puedeGenerar} className={`${BTN_PRIMARY} flex-1`}><Send className="w-4 h-4" /> Generar y enviar</button>
        </div>

        {url && (
          <div className="pt-2 border-t border-digi-border">
            <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Enlace</label>
            <div className="flex gap-2 mt-1">
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
                className="field-control flex-1 px-3 py-2 bg-digi-darker border-2 border-digi-border text-[12px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
              <button onClick={copiar} className={BTN_SECONDARY} title="Copiar enlace"><Copy className="w-4 h-4" /></button>
            </div>
            {aviso && <p className="mt-1.5 text-[11px] text-digi-muted" style={mf}>{aviso}</p>}
          </div>
        )}
      </div>
    </PixelModal>
  );
}
