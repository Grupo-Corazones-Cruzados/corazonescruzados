'use client';

import { useCallback, useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Fingerprint, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { BTN_PRIMARY } from '@/components/ui/Button';

const mf = { fontFamily: 'var(--font-body)' } as const;

type Passkey = {
  id: number;
  /** ¿Sirve hoy? Las de antes del cambio de dominio siguen guardadas pero no valen. */
  sirve: boolean;
  sincronizada: boolean;
  creada: string;
  usada: string | null;
};

/**
 * LAS PASSKEYS DE MI CUENTA.
 *
 * ── POR QUÉ ESTÁ AQUÍ (Fernando, 2026-09-26) ─────────────────────────────────────
 * Porque antes no estaba en ninguna parte. Crear una passkey solo se ofrecía al iniciar
 * sesión, y solo a quien no tenía ninguna; quien ya tenía una en otro aparato no podía
 * añadir la de este. Fernando se quedó encerrado justo así: no podía entrar con passkey
 * en el Mac —la suya vive en otro sitio— y tampoco crear una que estuviera en el Mac.
 *
 * Una passkey es de un aparato aunque se sincronice, así que tener varias es lo normal.
 * Aquí se ven todas, se añade la de este equipo y se quitan las que ya no se usen.
 */
export default function PasskeysPanel() {
  const [lista, setLista] = useState<Passkey[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/passkeys');
      const j = await r.json();
      setLista(r.ok ? (j.passkeys ?? []) : []);
    } catch {
      setLista([]);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const registrar = async () => {
    setError(null); setAviso(null); setOcupado(true);
    try {
      const inicio = await fetch('/api/auth/passkey/register/begin', { method: 'POST' });
      const opciones = await inicio.json();
      if (!inicio.ok) { setError(opciones?.error ?? 'No se pudo empezar el registro.'); return; }

      const credencial = await startRegistration({ optionsJSON: opciones });

      const fin = await fetch('/api/auth/passkey/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credencial),
      });
      const j = await fin.json();
      if (!fin.ok) { setError(j?.error ?? 'No se pudo guardar la passkey.'); return; }

      setAviso('Listo. La próxima vez entrarás con tu huella o tu cara, sin código.');
      await cargar();
    } catch (e) {
      // Cancelar no es un error: si cierras el diálogo del sistema, no se te regaña.
      const m = e instanceof Error ? e.message : 'No se pudo crear la passkey.';
      if (/already registered|excluded/i.test(m)) {
        setError('Este dispositivo ya tiene una passkey de tu cuenta.');
      } else if (!/cancel|abort|timeout|NotAllowed|not allowed/i.test(m)) {
        setError(m);
      }
    } finally {
      setOcupado(false);
    }
  };

  const quitar = async (id: number) => {
    setError(null); setAviso(null); setOcupado(true);
    try {
      const r = await fetch(`/api/auth/passkeys?id=${id}`, { method: 'DELETE' });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j?.error ?? 'No se pudo quitar.'); return; }
      await cargar();
    } finally {
      setOcupado(false);
    }
  };

  const fecha = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const utiles = (lista ?? []).filter((p) => p.sirve);
  const caducadas = (lista ?? []).filter((p) => !p.sirve);

  return (
    <div className="pt-3 border-t border-digi-border space-y-3">
      <h4 className="text-[13px] font-semibold text-digi-text" style={mf}>Acceso sin contraseña</h4>
      <p className="text-[12px] leading-relaxed text-digi-muted" style={mf}>
        Una passkey usa la huella, la cara o el PIN de este equipo en lugar del código por
        correo. Se guarda en el llavero del sistema, así que si tienes iCloud o tu cuenta de
        Google sincronizada, sirve también en tus otros aparatos.
      </p>

      {error && (
        <p className="flex items-start gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300" style={mf}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" /> {error}
        </p>
      )}
      {aviso && (
        <p className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-300" style={mf}>
          {aviso}
        </p>
      )}

      {lista === null ? (
        <p className="text-[12px] text-digi-muted" style={mf}>Cargando…</p>
      ) : utiles.length === 0 ? (
        <p className="text-[12px] text-digi-muted" style={mf}>Todavía no tienes ninguna.</p>
      ) : (
        <ul className="divide-y divide-digi-border rounded border border-digi-border">
          {utiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[12.5px] text-digi-text flex items-center gap-1.5" style={mf}>
                  <Fingerprint className="w-3.5 h-3.5 shrink-0" />
                  {p.sincronizada ? 'Passkey sincronizada' : 'Passkey de este equipo'}
                </p>
                <p className="text-[11px] text-digi-muted" style={mf}>
                  Creada el {fecha(p.creada)} · {p.usada ? `usada el ${fecha(p.usada)}` : 'sin usar'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => quitar(p.id)}
                disabled={ocupado}
                title="Quitar esta passkey"
                className="shrink-0 p-2 rounded text-digi-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Las que quedaron inservibles no se esconden: si no, quien recuerda haber creado
          una no entendería por qué no aparece. Se dice qué les pasó y se pueden borrar. */}
      {caducadas.length > 0 && (
        <p className="flex items-start gap-2 rounded border border-digi-border bg-digi-darker px-3 py-2 text-[11.5px] leading-relaxed text-digi-muted" style={mf}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Tienes {caducadas.length} passkey(s) de antes del cambio de dominio del 24 de
            septiembre. Ya no las acepta el navegador; crea una nueva aquí.
            <button
              type="button"
              onClick={() => caducadas.forEach((p) => void quitar(p.id))}
              disabled={ocupado}
              className="ml-1 underline underline-offset-2 hover:text-digi-text disabled:opacity-40"
            >
              Quitarlas
            </button>
          </span>
        </p>
      )}

      {/* La acción, abajo a la derecha. */}
      <div className="flex justify-end">
        <button type="button" onClick={registrar} disabled={ocupado} className={BTN_PRIMARY}>
          <span className="inline-flex items-center gap-2">
            {ocupado ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
            {ocupado ? 'Esperando…' : 'Añadir passkey de este equipo'}
          </span>
        </button>
      </div>
    </div>
  );
}
