'use client';

import { useCallback, useEffect, useState } from 'react';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER } from '@/components/ui/Button';
import PixelConfirm from '@/components/ui/PixelConfirm';
import EspacioDrive, { type EspacioDriveDatos } from '@/components/google/EspacioDrive';
import { CheckCircle2, XCircle, AlertTriangle, HardDrive, Mail, CalendarDays } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

interface Estado {
  puede: boolean;
  configurado: boolean;
  conexion: { email: string; estado: 'activa' | 'revocada'; conectadaEn: string; scopes: string[]; faltan: string[] } | null;
  espacio: EspacioDriveDatos | null;
}

/** Lo que vuelve en `?google=` desde el callback. */
const RESULTADO: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: 'Cuenta de Google conectada.' },
  cancelado: { ok: false, text: 'Cancelaste la conexión con Google.' },
  falta_drive: { ok: false, text: 'Hace falta permitir el acceso a Google Drive para guardar tus archivos.' },
  estado_invalido: { ok: false, text: 'La conexión caducó o se abrió desde otra sesión. Vuelve a intentarlo.' },
  no_configurado: { ok: false, text: 'La conexión con Google aún no está configurada en el servidor.' },
  sin_acceso: { ok: false, text: 'Esta función es para miembros y candidatos.' },
  error: { ok: false, text: 'Google no completó la conexión. Vuelve a intentarlo.' },
};

const PERMISOS = [
  { Icon: HardDrive, label: 'Google Drive', scope: 'https://www.googleapis.com/auth/drive' },
  { Icon: Mail, label: 'Gmail', scope: 'https://www.googleapis.com/auth/gmail.modify' },
  { Icon: CalendarDays, label: 'Google Calendar', scope: 'https://www.googleapis.com/auth/calendar' },
];

function LogoGoogle({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Configuración → Conexiones: conectar la cuenta de Google del usuario (Drive, Gmail y
 * Calendar). Es lo que habilita guardar los archivos de las Experiencias personales en
 * su propio Drive.
 */
export default function ConexionesPanel() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enApp, setEnApp] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/google/conexion');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setEstado(j.data);
      setErr(null);
    } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => {
    load();
    // Google bloquea su inicio de sesión dentro de un WebView: en la app nativa no se ofrece.
    setEnApp(!!(window as any).Capacitor?.isNativePlatform?.());
    const p = new URLSearchParams(window.location.search);
    const g = p.get('google');
    if (g) {
      setAviso(RESULTADO[g] || RESULTADO.error);
      p.delete('google');
      window.history.replaceState(null, '', `${window.location.pathname}${p.size ? `?${p}` : ''}`);
    }
  }, [load]);

  const desconectar = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/google/conexion', { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo desconectar.');
      setAviso({ ok: true, text: 'Cuenta de Google desconectada. Tus archivos siguen en tu Drive.' });
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const c = estado?.conexion;
  const revocada = c?.estado === 'revocada';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      {aviso && (
        <div className={`mb-3 px-3 py-2 rounded-md border text-[12px] flex items-center gap-2 ${aviso.ok ? 'border-green-300/60 bg-green-400/10 text-green-700' : 'border-red-400/40 bg-red-500/10 text-red-600'}`} style={mf}>
          {aviso.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />} {aviso.text}
        </div>
      )}
      {err && (
        <div className="mb-3 px-3 py-2 rounded-md border border-red-400/40 bg-red-500/10 text-[12px] text-red-600 flex items-center gap-2" style={mf}>
          <XCircle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      <div className="bg-digi-card border border-digi-border rounded-lg p-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-md border border-digi-border flex items-center justify-center shrink-0"><LogoGoogle /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-digi-text" style={df}>Google</p>
            {c ? (
              <p className="text-[12.5px] text-digi-muted mt-0.5 break-all" style={mf}>
                {c.email}
                {revocada
                  ? <span className="ml-2 inline-flex items-center gap-1 text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> Acceso retirado</span>
                  : <span className="ml-2 inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Conectada</span>}
              </p>
            ) : (
              <p className="text-[12.5px] text-digi-muted mt-0.5" style={mf}>Sin conectar</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {PERMISOS.map(({ Icon, label, scope }) => {
            const concedido = !!c && !revocada && c.scopes.includes(scope);
            return (
              <span key={scope} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${concedido ? 'bg-accent-light border-accent/30 text-accent' : 'bg-black/[0.04] border-digi-border text-digi-muted'}`} style={mf}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </span>
            );
          })}
        </div>

        {estado?.espacio && !revocada && <div className="mt-4"><EspacioDrive espacio={estado.espacio} /></div>}

        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-digi-border flex-wrap">
          {!estado ? (
            <span className="text-[12px] text-digi-muted" style={mf}>Cargando…</span>
          ) : !estado.puede ? (
            <span className="text-[12px] text-digi-muted" style={mf}>Disponible para miembros y candidatos.</span>
          ) : enApp ? (
            <span className="text-[12px] text-digi-muted" style={mf}>Para conectar Google, entra a app.grupocc.org desde el navegador.</span>
          ) : (
            <>
              {c && <button className={BTN_DANGER} disabled={busy} onClick={() => setConfirmar(true)} style={mf}>Desconectar</button>}
              {c ? (
                <a className={revocada || c.faltan.length ? BTN_PRIMARY : BTN_SECONDARY} href="/api/google/conectar" style={mf}>
                  {revocada ? 'Reconectar' : c.faltan.length ? 'Conceder permisos' : 'Cambiar de cuenta'}
                </a>
              ) : (
                <a className={`${BTN_PRIMARY} ${estado.configurado ? '' : 'pointer-events-none opacity-50'}`} href="/api/google/conectar" style={mf}>
                  <LogoGoogle className="w-4 h-4 bg-white rounded-sm p-px" /> Conectar con Google
                </a>
              )}
            </>
          )}
        </div>
      </div>

      <PixelConfirm
        open={confirmar}
        danger
        title="Desconectar Google"
        message="La app dejará de ver tus archivos de Experiencias. No se borra nada de tu Google Drive y puedes volver a conectar cuando quieras."
        confirmLabel="Desconectar"
        onCancel={() => setConfirmar(false)}
        onConfirm={() => { setConfirmar(false); desconectar(); }}
      />
    </div>
  );
}
