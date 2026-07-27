'use client';

import BrandLoader from '@/components/ui/BrandLoader';
import { fmtNum } from '@/lib/format';

/**
 * Pantalla de carga del juego (NIVEL APP → NIVEL MOTOR).
 *
 * Es lo primero que ve el jugador tras iniciar sesión, así que va en el lenguaje
 * de la portada —Silkscreen, morado de marca, bordes duros— y no en el del
 * dashboard. Sigue las dos reglas del sistema de diseño:
 * - **`BrandLoader` en toda pantalla de carga** (logo animado de GCC World).
 * - **Colores por token**: `--color-void` (el mismo negro que pinta el motor, así
 *   no hay salto al arrancar) y `--color-accent*` para la barra.
 *
 * La barra es honesta: `loaded`/`total` son bytes REALES de descarga que reporta
 * el motor. Cuando no se conoce el total, se muestra indeterminada en vez de
 * fingir un porcentaje.
 */

export type LoadingPhase =
  /** Pidiendo el motor (index.js) y los tamaños del export. */
  | 'preparando'
  /** Bajando wasm + pck: aquí la barra avanza de verdad. */
  | 'descargando'
  /** Descarga completa; el navegador compila el wasm y Godot arranca. */
  | 'iniciando';

const TEXTO: Record<LoadingPhase, string> = {
  preparando: 'Preparando la entrada…',
  descargando: 'Descargando el mundo…',
  iniciando: 'Encendiendo el motor…',
};

const MB = 1024 * 1024;

export default function GameLoadingScreen({
  phase,
  loaded,
  total,
  stalled = false,
}: {
  phase: LoadingPhase;
  /** Bytes descargados hasta ahora. */
  loaded: number;
  /** Bytes totales a descargar. 0 = desconocido → barra indeterminada. */
  total: number;
  /** El arranque se está eternizando: se avisa y se ofrece reintentar. */
  stalled?: boolean;
}) {
  const conocido = total > 0;
  // Se reserva el último 1 % para el arranque del motor: llegar a 100 % y
  // quedarse ahí un rato es la forma más rápida de que parezca colgado.
  const pct = conocido ? Math.min(99, Math.floor((loaded / total) * 100)) : 0;
  const mostrado = phase === 'iniciando' ? 100 : pct;

  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6 px-8 text-center"
      style={{ background: 'var(--color-void)' }}
      role="status"
      aria-live="polite"
    >
      <BrandLoader size="lg" />

      <p
        className="pixel-heading pixel-glow text-[13px] uppercase tracking-[0.2em] text-white"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        GCC World
      </p>

      <div className="w-full max-w-[320px]">
        <div className="pixel-progress">
          <div
            className={`pixel-progress-fill${conocido ? '' : ' pixel-progress-fill--idle'}`}
            style={conocido ? { width: `${mostrado}%` } : undefined}
          />
        </div>

        <div
          className="mt-3 flex items-baseline justify-between gap-3 text-[10px] uppercase tracking-[0.12em]"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent-glow)' }}
        >
          <span>{TEXTO[phase]}</span>
          {conocido && <span className="text-white/70">{mostrado}%</span>}
        </div>

        {/* El peso real tranquiliza: son ~50 MB y sin esto parece que no pasa nada. */}
        {conocido && phase === 'descargando' && (
          <p className="mt-1 text-left text-[10px] text-white/35" style={{ fontFamily: 'var(--font-display)' }}>
            {fmtNum(loaded / MB, 1)} de {fmtNum(total / MB, 1)} MB
          </p>
        )}
      </div>

      {stalled ? (
        // Se recupera el puntero SOLO para el botón: el resto de la pantalla
        // sigue sin capturar clics.
        <div className="pointer-events-auto flex max-w-[320px] flex-col items-center gap-3">
          <p className="text-[10px] leading-relaxed text-white/45" style={{ fontFamily: 'var(--font-display)' }}>
            Esto está tardando más de lo normal. Suele pasar si el juego se
            actualizó mientras cargaba.
          </p>
          <button
            type="button"
            className="pixel-btn pixel-btn-secondary"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <p className="max-w-[320px] text-[10px] leading-relaxed text-white/25" style={{ fontFamily: 'var(--font-display)' }}>
          La primera vez tarda más: el mundo se guarda en tu navegador.
        </p>
      )}
    </div>
  );
}
