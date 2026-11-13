'use client';

/**
 * «NO SOY UN ROBOT» de los registros (Fernando, 2026-10-29) — ALTCHA por debajo.
 *
 * Al tocarlo, el navegador resuelve una prueba de trabajo (~1 s) y entrega una «solución» que el
 * formulario manda en el campo `altcha`; el servidor la comprueba en `lib/registro/captcha.ts`.
 *
 * ⇒ BOTÓN PROPIO Y ANIMADO (Fernando, 2026-11-13: «el botón de no soy un robot está casi transparente;
 * quiero un diseño más animado»). El widget de ALTCHA sigue montado pero invisible: hace el cálculo y
 * este botón lo dispara con `verify()` y pinta cada estado — esperando (escudo que late), verificando
 * (giro y barra que avanza) y verificado (check verde que aparece con un salto).
 *
 * `onCambio(solución | null)`: la solución al verificarse; `null` si caduca o falla.
 * `reinicio`: cambiarlo deja el botón como al principio (tras un error del servidor la solución ya se
 * gastó y hay que resolver otra).
 */

import { createElement, useEffect, useRef, useState } from 'react';
import { ShieldCheck, Check, Loader2, RotateCcw } from 'lucide-react';

type Estado = 'espera' | 'verificando' | 'verificado' | 'error';

const mf = { fontFamily: 'var(--font-body)' } as const;

// `auto`: los colores del tema donde aparece (variables del panel: claro u oscuro según la persona).
// `claro`/`oscuro`: superficies con fondo fijo (el sitio, la historia, la postulación).
const COLORES = {
  auto: { texto: 'var(--color-digi-text)', suave: 'var(--color-digi-muted)', borde: 'color-mix(in srgb, var(--color-accent) 45%, transparent)', acento: 'var(--color-accent)', halo: 'color-mix(in srgb, var(--color-accent) 16%, transparent)', pista: 'color-mix(in srgb, var(--color-accent) 14%, transparent)' },
  claro: { texto: '#17122b', suave: '#6b6485', borde: '#c9bdf3', acento: '#7c3aed', halo: 'rgba(124,58,237,0.12)', pista: '#ede9fe' },
  oscuro: { texto: '#ece9f7', suave: '#b6aedb', borde: 'rgba(167,139,250,0.55)', acento: '#a78bfa', halo: 'rgba(167,139,250,0.18)', pista: 'rgba(167,139,250,0.18)' },
};

export default function Captcha({
  onCambio,
  reinicio = 0,
  tema = 'claro',
}: {
  onCambio: (solucion: string | null) => void;
  reinicio?: number;
  tema?: 'claro' | 'oscuro' | 'auto';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>('espera');
  const [avance, setAvance] = useState(0);
  const onCambioRef = useRef(onCambio);
  onCambioRef.current = onCambio;
  const c = COLORES[tema];

  useEffect(() => {
    let vivo = true;
    Promise.all([import('altcha'), import('altcha/i18n/es-419')])
      .then(() => { if (vivo) setListo(true); })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !listo) return;
    const alCambiar = (e: Event) => {
      const d = (e as CustomEvent<{ state: string; payload?: string }>).detail;
      const s = d?.state;
      if (s === 'verified' && d.payload) { setEstado('verificado'); onCambioRef.current(d.payload); return; }
      onCambioRef.current(null);
      if (s === 'verifying') setEstado('verificando');
      else if (s === 'error') setEstado('error');
      else setEstado('espera'); // unverified / expired
    };
    el.addEventListener('statechange', alCambiar);
    return () => el.removeEventListener('statechange', alCambiar);
  }, [listo]);

  useEffect(() => {
    if (!reinicio) return;
    (ref.current as unknown as { reset?: () => void } | null)?.reset?.();
    setEstado('espera');
    onCambioRef.current(null);
  }, [reinicio]);

  // La barra avanza mientras se calcula (no hay progreso real: la prueba dura alrededor de un segundo).
  useEffect(() => {
    if (estado !== 'verificando') { setAvance(estado === 'verificado' ? 100 : 0); return; }
    setAvance(8);
    const t = setInterval(() => setAvance((a) => Math.min(a + (92 - a) * 0.18, 92)), 120);
    return () => clearInterval(t);
  }, [estado]);

  const verificar = () => {
    if (!listo || estado === 'verificando' || estado === 'verificado') return;
    setEstado('verificando');
    (ref.current as unknown as { verify?: () => Promise<unknown> } | null)?.verify?.()
      ?.catch(() => setEstado('error'));
  };

  const hecho = estado === 'verificado';
  const color = hecho ? '#16a34a' : estado === 'error' ? '#dc2626' : c.acento;
  const texto = hecho ? 'Verificado: eres una persona'
    : estado === 'verificando' ? 'Verificando…'
      : estado === 'error' ? 'No se pudo verificar. Toca para intentarlo de nuevo'
        : 'Toca para confirmar que no eres un robot';

  return (
    <div>
      <button
        type="button"
        onClick={verificar}
        disabled={!listo || estado === 'verificando'}
        aria-live="polite"
        className="group relative w-full overflow-hidden flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition-all duration-300 focus:outline-none active:scale-[0.98] disabled:cursor-default"
        style={{ borderColor: hecho ? '#16a34a' : estado === 'error' ? '#dc2626' : c.borde, ...mf }}
      >
        {/* El icono: late mientras espera, gira mientras calcula y salta al verificarse. */}
        <span className="relative shrink-0 w-10 h-10 flex items-center justify-center">
          {estado === 'espera' && (
            <span className="absolute inset-0 rounded-full animate-ping" style={{ background: c.halo }} />
          )}
          <span
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 ${hecho ? 'scale-110' : 'scale-100'}`}
            style={{ background: hecho ? '#16a34a' : c.halo, color: hecho ? '#ffffff' : color }}
          >
            {hecho ? <Check className="w-5 h-5 animate-[pixelFadeIn_0.3s_ease-out]" strokeWidth={3} />
              : estado === 'verificando' ? <Loader2 className="w-5 h-5 animate-spin" />
                : estado === 'error' ? <RotateCcw className="w-5 h-5" />
                  : <ShieldCheck className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />}
          </span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold leading-snug" style={{ color: hecho ? '#16a34a' : estado === 'error' ? '#dc2626' : c.texto }}>
            {texto}
          </span>
          {/* La barra: avanza al verificar y se llena en verde al terminar. */}
          <span className="mt-2 block h-1 w-full rounded-full overflow-hidden" style={{ background: c.pista }}>
            <span className="block h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${avance}%`, background: color }} />
          </span>
        </span>
      </button>

      {/* ALTCHA hace el cálculo; no se ve (lo dispara el botón de arriba). */}
      <div aria-hidden className="absolute w-px h-px overflow-hidden opacity-0 pointer-events-none" style={{ clip: 'rect(0 0 0 0)' }}>
        {createElement('altcha-widget', {
          ref,
          challenge: '/api/registro/desafio',
          language: 'es-419',
          name: 'altcha',
          type: 'checkbox',
          configuration: JSON.stringify({ hideLogo: true, hideFooter: true }),
        })}
      </div>
    </div>
  );
}
