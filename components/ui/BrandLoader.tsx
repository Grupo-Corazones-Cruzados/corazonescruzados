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
 *
 * ── 2026-10-30 (Fernando: «que su diseño sea nuevo e interesante cuando está cargando algo») ──
 * Dos arcos: el de fuera en el acento, girando; el de dentro, más corto y en sentido contrario,
 * con el degradado del tema detrás (`--degradado-acento`). El texto, en la letra del panel y
 * tenue, con tres puntos que laten —antes era la letra pixel en mayúsculas—. La pantalla de
 * carga ENTERA del panel ya no es esto, sino `CargaPanel` (la silueta del panel).
 * ⚠️ El arco de fuera conserva `.animate-spin` dentro de `role=status`: así reconoce
 * `useEntradaTrasCarga` (layout del panel) que la página estaba cargando.
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
  const interior = Math.round(px * 0.56);
  // «Cargando ticket...» → «Cargando ticket» + los puntos que laten.
  const texto = label?.replace(/(\.\.\.|…)\s*$/, '');

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`} role="status" aria-live="polite">
      <span className="relative shrink-0 grid place-items-center" style={{ width: px, height: px }}>
        {/* La pista completa, tenue: el hueco que gira se entiende como un recorrido. */}
        <span className="absolute inset-0 rounded-full border-digi-border opacity-60" style={{ borderWidth: grosor, borderStyle: 'solid' }} />
        {/* El arco de fuera, en el acento. Quieto con «reducir movimiento»: sigue leyéndose como carga. */}
        <span
          className="absolute inset-0 rounded-full animate-spin motion-reduce:animate-none"
          style={{
            borderWidth: grosor,
            borderStyle: 'solid',
            borderColor: 'var(--color-accent) var(--color-accent) transparent transparent',
            animationDuration: '0.9s',
            animationTimingFunction: 'cubic-bezier(0.5, 0.1, 0.4, 0.9)',
          }}
        />
        {/* El de dentro: el degradado del tema enmascarado en un cuarto de anillo, al revés. */}
        {size !== 'sm' && (
          <span
            className="rounded-full motion-reduce:hidden"
            style={{
              width: interior, height: interior,
              background: 'var(--degradado-acento, var(--color-accent))',
              WebkitMaskImage: `conic-gradient(#000 0 30%, transparent 30%), radial-gradient(farthest-side, transparent calc(100% - ${grosor}px), #000 calc(100% - ${grosor}px))`,
              WebkitMaskComposite: 'source-in',
              maskImage: `conic-gradient(#000 0 30%, transparent 30%), radial-gradient(farthest-side, transparent calc(100% - ${grosor}px), #000 calc(100% - ${grosor}px))`,
              maskComposite: 'intersect',
              animation: 'spin 1.4s linear infinite reverse',
            }}
          />
        )}
      </span>
      {texto && (
        <p className="text-[12.5px] font-medium text-digi-muted inline-flex items-baseline whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>
          {texto}
          <span aria-hidden className="carga-puntos ml-px" />
        </p>
      )}
    </div>
  );
}
