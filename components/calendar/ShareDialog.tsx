'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ShareDialog({ open, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/members/calendar/public-link');
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setMemberId(data.member_id);
        setCreatedAt(data.created_at);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const url = token && memberId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/calendario/${memberId}?token=${token}`
    : '';

  const generate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/members/calendar/public-link', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setToken(data.token);
      setMemberId(data.member_id);
      setCreatedAt(new Date().toISOString());
      toast.success('Enlace generado');
    } catch {
      toast.error('Error al generar enlace');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async () => {
    if (!confirm('¿Revocar el enlace? Los clientes perderán acceso al calendario.')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/members/calendar/public-link', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setToken(null);
      setCreatedAt(null);
      toast.success('Enlace revocado');
    } catch {
      toast.error('Error al revocar');
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  return (
    <PixelModal open={open} onClose={onClose} title="Compartir calendario" size="md">
      <div className="space-y-4">
        <p className="text-[11px] text-digi-muted leading-relaxed">
          Genera un enlace público de solo lectura para que tus clientes revisen tu calendario.
          Puedes revocarlo cuando quieras.
        </p>

        {loading ? (
          <div className="text-[10px] text-digi-muted text-center py-4" style={pf}>Cargando…</div>
        ) : token ? (
          <>
            <div className="space-y-1">
              <div className="text-[10px] text-accent-glow opacity-70" style={pf}>ENLACE ACTUAL</div>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  className="flex-1 px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none"
                  style={mf}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={copy}
                  className="px-3 py-2 text-[10px] border-2 border-accent bg-accent/20 text-accent-glow hover:bg-accent/30 transition-colors whitespace-nowrap"
                  style={pf}
                >
                  COPIAR
                </button>
              </div>
              {createdAt && (
                <div className="text-[9px] text-digi-muted" style={pf}>
                  GENERADO: {new Date(createdAt).toLocaleString()}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-digi-border">
              <button
                onClick={generate}
                disabled={saving}
                className="flex-1 px-3 py-2 text-[10px] border-2 border-digi-border text-digi-text hover:border-accent transition-colors disabled:opacity-50"
                style={pf}
              >
                REGENERAR
              </button>
              <button
                onClick={revoke}
                disabled={saving}
                className="flex-1 px-3 py-2 text-[10px] border-2 border-red-500/50 text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-50"
                style={pf}
              >
                REVOCAR
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-[11px] text-digi-muted mb-3">No hay enlace activo.</div>
            <button
              onClick={generate}
              disabled={saving}
              className="px-4 py-2 text-[10px] border-2 border-accent bg-accent/20 text-accent-glow hover:bg-accent/30 transition-colors disabled:opacity-50"
              style={pf}
            >
              {saving ? 'GENERANDO…' : 'GENERAR ENLACE'}
            </button>
          </div>
        )}
      </div>
    </PixelModal>
  );
}
