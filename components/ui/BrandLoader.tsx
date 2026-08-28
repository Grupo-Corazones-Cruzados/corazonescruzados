'use client';

/**
 * BrandLoader — el indicador de carga de toda la aplicación (~30 pantallas).
 *
 * ── QUÉ CAMBIÓ (2026-08-28) y por qué ─────────────────────────────────────────────────
 * Esto pintaba el LOGO girando. Dos problemas, y el segundo es el de fondo:
 *
 *  1. **Tardaba en aparecer.** Es una imagen: hay que pedirla y descargarla. Justo en el
 *     momento en que la pantalla está vacía y el usuario se pregunta si pasa algo, el
 *     indicador de que sí pasa algo… todavía no estaba. Un indicador de carga que carga es
 *     una contradicción.
 *
 *  2. **No dice lo que tiene que decir.** Un logo dando vueltas se lee como adorno de
 *     marca. Un anillo girando se lee como «espera, esto tarda», que es exactamente el
 *     mensaje. La marca ya está en el raíl, en la pestaña y en la pantalla de acceso; aquí
 *     lo que hace falta es informar, no firmar.
 *
 * Ahora son dos `<div>` con borde: **cero peticiones, cero bytes**, pintado en el mismo
 * fotograma en que aparece.
 *
 * El logo sigue siendo el logo — en la barra lateral y en los diálogos de acceso —, pero
 * ya no hace de reloj de arena.
 *
 * Tamaños: sm (18 px), md (28 px), lg (40 px).
 */

const SIZES = {
  sm: { px: 18, grosor: 2 },
  md: { px: 28, grosor: 3 },
  lg: { px: 40, grosor: 3 },
} as const;

export default function BrandLoader({
  size = 'md',
  label,
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}) {
  const { px, grosor } = SIZES[size];
  const pf = { fontFamily: 'var(--font-display)' } as const;

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`} role="status" aria-live="polite">
      <span className="relative shrink-0" style={{ width: px, height: px }}>
        {/* La pista completa, tenue: da el círculo entero para que el hueco que gira se
            entienda como un recorrido y no como un arco suelto. */}
        <span
          className="absolute inset-0 rounded-full border-digi-border"
          style={{ borderWidth: grosor, borderStyle: 'solid' }}
        />
        {/* El arco que gira. Tres lados transparentes: lo que se ve es un cuarto de vuelta.
            ⚠️ `motion-reduce:animate-none`: sin animación se queda un arco quieto y sigue
            leyéndose como «cargando», sin marear a quien pide menos movimiento. */}
        <span
          className="absolute inset-0 rounded-full animate-spin motion-reduce:animate-none"
          style={{
            borderWidth: grosor,
            borderStyle: 'solid',
            borderColor: 'var(--color-accent) transparent transparent transparent',
            animationDuration: '0.7s',
          }}
        />
      </span>
      {label && (
        <p className="text-[10px] text-accent-glow opacity-60" style={pf}>
          {label}
        </p>
      )}
    </div>
  );
}
