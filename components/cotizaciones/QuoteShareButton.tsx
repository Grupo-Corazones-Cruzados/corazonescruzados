'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { Copy, Send } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const DURATIONS = [
  { v: 24, l: '1 día' }, { v: 168, l: '1 semana' }, { v: 720, l: '1 mes' }, { v: 2160, l: '3 meses' },
];

/**
 * Modal para compartir la cotización con el cliente externo por token con expiración
 * (enlace de solo lectura + agente + aceptar/rechazar). Puede enviarlo por correo o copiar el link.
 * Controlado: se abre desde el botón "Compartir acceso" del header.
 */
export default function QuoteShareButton({ projectId, open, onClose }: { projectId: number | string; open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [hours, setHours] = useState(168);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');

  const generate = async (sendEmail: boolean) => {
    if (sendEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error('Ingresa un correo válido'); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/quotes/${projectId}/share`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationHours: hours, email: sendEmail ? email.trim() : undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setUrl(d.data.url);
      toast.success(d.data.emailed ? 'Cotización enviada al cliente por correo' : 'Enlace generado');
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setBusy(false); }
  };
  const copy = () => { if (url) { navigator.clipboard.writeText(url); toast.success('Enlace copiado'); } };

  return (
    <PixelModal open={open} onClose={onClose} title="Compartir acceso a la cotización">
        <div className="space-y-3">
          <p className="text-[12px] text-digi-muted" style={mf}>
            Genera un enlace de <strong>solo lectura</strong> para el cliente: verá la cotización, podrá <strong>aceptar/rechazar</strong> y pedir cambios al asistente GCC Bot.
          </p>

          <div className="flex flex-col gap-1">
            <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Vigencia del enlace</label>
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))}
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf}>
              {DURATIONS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
            </select>
          </div>

          <PixelInput label="Correo del cliente (para enviarlo)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@correo.com" />

          <div className="flex gap-2">
            <button onClick={() => generate(false)} disabled={busy} className={`${BTN_SECONDARY} flex-1`}>Generar enlace</button>
            <button onClick={() => generate(true)} disabled={busy} className={`${BTN_PRIMARY} flex-1`}><Send className="w-4 h-4" /> Generar y enviar</button>
          </div>

          {url && (
            <div className="pt-2 border-t border-digi-border">
              <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Enlace</label>
              <div className="flex gap-2 mt-1">
                <input readOnly value={url} className="field-control flex-1 px-3 py-2 bg-digi-darker border-2 border-digi-border text-[12px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                <button onClick={copy} className={BTN_SECONDARY}><Copy className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
    </PixelModal>
  );
}
