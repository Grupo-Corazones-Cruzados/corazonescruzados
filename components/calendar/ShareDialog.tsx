'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER } from '@/components/ui/Button';
import { Copy, RefreshCw, Trash2, Link as LinkIcon } from 'lucide-react';

const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;

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
  const [confirmRevoke, setConfirmRevoke] = useState(false);

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
    setConfirmRevoke(false);
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
        <p className="text-[13px] text-digi-muted leading-relaxed" style={mf}>
          Genera un enlace público de solo lectura para que tus clientes revisen tu calendario.
          Puedes revocarlo cuando quieras.
        </p>

        {loading ? (
          <div className="text-[13px] text-digi-muted text-center py-4" style={mf}>Cargando…</div>
        ) : token ? (
          <>
            <div className="space-y-1">
              <div className="text-[12px] font-medium text-digi-muted" style={mf}>Enlace actual</div>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  className="field-control w-full px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none"
                  style={mf}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button onClick={copy} className={`${BTN_PRIMARY} whitespace-nowrap`} style={mf}>
                  <Copy className="w-4 h-4" /> Copiar
                </button>
              </div>
              {createdAt && (
                <div className="text-[11px] text-digi-muted" style={mf}>
                  Generado: {new Date(createdAt).toLocaleString()}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-digi-border">
              <button
                onClick={generate}
                disabled={saving}
                className={`${BTN_SECONDARY} flex-1`}
                style={mf}
              >
                <RefreshCw className="w-4 h-4" /> Regenerar
              </button>
              <button
                onClick={() => setConfirmRevoke(true)}
                disabled={saving}
                className={`${BTN_DANGER} flex-1`}
                style={mf}
              >
                <Trash2 className="w-4 h-4" /> Revocar
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-[13px] text-digi-muted mb-3" style={mf}>No hay enlace activo.</div>
            <button
              onClick={generate}
              disabled={saving}
              className={BTN_PRIMARY}
              style={mf}
            >
              <LinkIcon className="w-4 h-4" /> {saving ? 'Generando…' : 'Generar enlace'}
            </button>
          </div>
        )}
      </div>

      <PixelConfirm
        open={confirmRevoke}
        title="Revocar enlace"
        message="¿Revocar el enlace? Los clientes perderán acceso al calendario."
        confirmLabel="Sí, revocar"
        danger
        onConfirm={revoke}
        onCancel={() => setConfirmRevoke(false)}
      />
    </PixelModal>
  );
}
