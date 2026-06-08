'use client';

/**
 * BrandLoader — Logo animado oficial de GCC World.
 *
 * Usa el spritesheet del logo con animación ping-pong (frames 2→3→4→5→4→3)
 * y rotación 360° antihoraria. DEBE usarse en toda pantalla de carga.
 *
 * Tamaños: sm (36px), md (56px), lg (80px)
 */

const SIZES = {
  sm: { box: 36, bg: '256px 256px', y: '185px', sx: '-9.9px', fw: '-40px', border: 2 },
  md: { box: 56, bg: '398px 398px', y: '288px', sx: '-15.4px', fw: '-62.2px', border: 3 },
  lg: { box: 80, bg: '569px 569px', y: '411px', sx: '-22px', fw: '-88.9px', border: 4 },
};

export default function BrandLoader({
  size = 'md',
  label,
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}) {
  const s = SIZES[size];
  const pf = { fontFamily: 'var(--font-display)' } as const;

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Outer: rotación 360° antihoraria */}
      <div
        style={{
          width: s.box,
          height: s.box,
          animation: 'slowSpin 12s linear infinite reverse',
        }}
      >
        {/* Clip circular con borde y fondo negro — el fondo negro forma un anillo
            alrededor del muñeco para que no toque el borde de la circunferencia */}
        <div className="rounded-full overflow-hidden" style={{ width: s.box, height: s.box, border: `${s.border}px solid #000`, background: '#000' }}>
          {/* Sprite ping-pong, reducido para dejar margen (el muñeco no toca el borde) */}
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: 'scale(1.07)',
              backgroundImage: 'url(/logo-spritesheet.png)',
              backgroundSize: s.bg,
              backgroundPositionY: s.y,
              imageRendering: 'auto',
              '--sx': s.sx,
              '--fw': s.fw,
              animation: 'spritePingPong 3s linear infinite',
            } as React.CSSProperties}
          />
        </div>
      </div>
      {label && (
        <p className="text-[10px] text-accent-glow opacity-60" style={pf}>
          {label}
        </p>
      )}
    </div>
  );
}
