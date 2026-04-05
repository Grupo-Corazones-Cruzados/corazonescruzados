'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface Props {
  projectId: string | number;
  className?: string;
  label?: string;
}

type DurationPreset = { label: string; hours: number };
const PRESETS: DurationPreset[] = [
  { label: '1 hora', hours: 1 },
  { label: '1 dia', hours: 24 },
  { label: '1 semana', hours: 168 },
  { label: '1 mes', hours: 720 },
];

export default function ProformaTokenButton({ projectId, className, label = 'Token' }: Props) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState<number>(24);
  const [generating, setGenerating] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const reset = () => { setLink(null); setExpiresAt(null); setHours(24); };

  const generate = async () => {
    if (hours < 1 || hours > 8760) { toast.error('Duracion fuera de rango'); return; }
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/proforma/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationHours: hours }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      const url = `${window.location.origin}/proforma/${projectId}?token=${data.token}`;
      setLink(url);
      setExpiresAt(data.expiresAt);
      toast.success('Token generado');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Enlace copiado');
    } catch { toast.error('No se pudo copiar'); }
  };

  const revoke = async () => {
    if (!confirm('Revocar el token actual? El enlace dejara de funcionar.')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/proforma/token`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error');
      toast.success('Token revocado');
      reset();
      setOpen(false);
    } catch { toast.error('Error al revocar'); }
  };

  const formatExpiry = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <button onClick={() => { reset(); setOpen(true); }} className={className} style={pf}>
        {label}
      </button>

      <PixelModal open={open} onClose={() => setOpen(false)} title="Enlace de acceso a la proforma" size="md">
        {!link ? (
          <div className="space-y-3">
            <p className="text-[10px] text-digi-muted" style={mf}>
              Genera un enlace temporal que podras compartir con el cliente para que acceda a la proforma sin iniciar sesion.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-accent-glow opacity-70" style={pf}>Duracion</label>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {PRESETS.map(p => (
                  <button key={p.hours} onClick={() => setHours(p.hours)}
                    className={`px-2 py-1.5 text-[8px] border transition-colors ${
                      hours === p.hours
                        ? 'bg-accent/20 border-accent text-accent-glow'
                        : 'border-digi-border text-digi-muted hover:text-digi-text hover:border-digi-border/60'
                    }`} style={pf}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={hours} min={1} max={8760}
                  onChange={e => setHours(Math.max(1, Math.min(8760, Number(e.target.value) || 1)))}
                  className="w-24 px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                <span className="text-[9px] text-digi-muted" style={pf}>horas (max 8760 = 1 ano)</span>
              </div>
            </div>
            <button onClick={generate} disabled={generating}
              className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
              {generating ? 'Generando...' : 'Generar enlace'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="px-3 py-2 bg-green-900/20 border border-green-500/30">
              <p className="text-[9px] text-green-400" style={pf}>Enlace generado</p>
              {expiresAt && <p className="text-[9px] text-digi-muted mt-0.5" style={mf}>Expira: {formatExpiry(expiresAt)}</p>}
            </div>
            <div className="flex gap-1.5">
              <input readOnly value={link} onClick={e => (e.target as HTMLInputElement).select()}
                className="flex-1 px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-[9px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
              <button onClick={copy} className="px-3 py-1.5 text-[9px] bg-accent/20 text-accent-glow border border-accent/40 hover:bg-accent/30 transition-colors" style={pf}>
                Copiar
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.open(link, '_blank')}
                className="flex-1 px-3 py-1.5 text-[9px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors" style={pf}>
                Abrir
              </button>
              <button onClick={revoke}
                className="px-3 py-1.5 text-[9px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors" style={pf}>
                Revocar
              </button>
              <button onClick={reset}
                className="px-3 py-1.5 text-[9px] text-digi-muted border border-digi-border hover:text-digi-text transition-colors" style={pf}>
                Nuevo
              </button>
            </div>
          </div>
        )}
      </PixelModal>
    </>
  );
}
