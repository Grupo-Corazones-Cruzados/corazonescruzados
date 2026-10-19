'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER } from '@/components/ui/Button';
import { Copy, RefreshCw, Trash2, Link as LinkIcon, CalendarPlus } from 'lucide-react';

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

        {open && <EnlaceIcal />}
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

/**
 * ⇒ ENLACE iCal PARA OTRAS APPS (Fernando, 2026-10-19): portarretrato digital, Google Calendar
 * (y por él Alexa), Apple, Outlook. A diferencia del enlace de arriba, lleva los TÍTULOS: es
 * para las pantallas propias, no para clientes. Ver `lib/calendar/ical.ts`.
 */
function EnlaceIcal() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [creado, setCreado] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<'regenerar' | 'desactivar' | null>(null);

  useEffect(() => {
    fetch('/api/members/calendar/feed-link').then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setUrl(d.url); setCreado(d.created_at); } })
      .finally(() => setCargando(false));
  }, []);

  const generar = async () => {
    setConfirmar(null);
    setGuardando(true);
    try {
      const r = await fetch('/api/members/calendar/feed-link', { method: 'POST' });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setUrl(d.url); setCreado(d.created_at);
      toast.success('Enlace iCal generado');
    } catch { toast.error('Error al generar el enlace'); }
    finally { setGuardando(false); }
  };

  const desactivar = async () => {
    setConfirmar(null);
    setGuardando(true);
    try {
      const r = await fetch('/api/members/calendar/feed-link', { method: 'DELETE' });
      if (!r.ok) throw new Error();
      setUrl(null); setCreado(null);
      toast.success('Enlace iCal desactivado');
    } catch { toast.error('Error al desactivar'); }
    finally { setGuardando(false); }
  };

  const copiar = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); toast.success('Enlace copiado'); }
    catch { toast.error('No se pudo copiar'); }
  };

  return (
    <div className="space-y-3 pt-4 border-t border-digi-border">
      <div>
        <div className="text-[13px] font-semibold text-digi-text" style={mf}>Conectar con otras apps (iCal)</div>
        <p className="text-[13px] text-digi-muted leading-relaxed mt-1" style={mf}>
          Para un portarretrato digital, Google Calendar (y desde él Alexa), Apple u Outlook. Incluye los
          títulos de tus eventos: no lo compartas con clientes.
        </p>
      </div>
      {cargando ? (
        <div className="text-[13px] text-digi-muted text-center py-2" style={mf}>Cargando…</div>
      ) : url ? (
        <>
          <div className="space-y-1">
            <div className="flex gap-2">
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
                className="field-control w-full px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none"
                style={mf} aria-label="Enlace iCal" />
              <button onClick={copiar} className={`${BTN_PRIMARY} whitespace-nowrap`} style={mf}><Copy className="w-4 h-4" /> Copiar</button>
            </div>
            {creado && <div className="text-[11px] text-digi-muted" style={mf}>Generado: {new Date(creado).toLocaleString()}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={url.replace(/^https?:/, 'webcal:')} className={`${BTN_SECONDARY} flex-1 justify-center`} style={mf}>
              <CalendarPlus className="w-4 h-4" /> Abrir en Calendario
            </a>
            <button onClick={() => setConfirmar('regenerar')} disabled={guardando} className={`${BTN_SECONDARY} flex-1`} style={mf}>
              <RefreshCw className="w-4 h-4" /> Regenerar
            </button>
            <button onClick={() => setConfirmar('desactivar')} disabled={guardando} className={`${BTN_DANGER} flex-1`} style={mf}>
              <Trash2 className="w-4 h-4" /> Desactivar
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-2">
          <button onClick={generar} disabled={guardando} className={BTN_PRIMARY} style={mf}>
            <CalendarPlus className="w-4 h-4" /> {guardando ? 'Generando…' : 'Generar enlace iCal'}
          </button>
        </div>
      )}
      <PixelConfirm
        open={confirmar !== null}
        title={confirmar === 'regenerar' ? 'Regenerar enlace iCal' : 'Desactivar enlace iCal'}
        message={confirmar === 'regenerar'
          ? 'El enlace actual dejará de funcionar: tendrás que pegar el nuevo en cada app conectada.'
          : 'Las apps conectadas dejarán de recibir tu calendario.'}
        confirmLabel={confirmar === 'regenerar' ? 'Sí, regenerar' : 'Sí, desactivar'}
        danger
        onConfirm={() => (confirmar === 'regenerar' ? generar() : desactivar())}
        onCancel={() => setConfirmar(null)}
      />
    </div>
  );
}
