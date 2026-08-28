'use client';

/**
 * BrandLoader — el logo de GCC World, girando. **La marca de toda la aplicación.**
 *
 * Se usa en la barra lateral y en TODA pantalla de carga (unos treinta sitios), así que
 * cambiarlo aquí lo cambia en todas. Ese es justo el motivo de que exista un componente y
 * no un `<img>` copiado: la marca se toca en un sitio.
 *
 * ── QUÉ CAMBIÓ (2026-08-28) ───────────────────────────────────────────────────────────
 * Antes esto pintaba un **spritesheet del muñeco del videojuego** (`logo-spritesheet.png`,
 * 1,1 MB) con una animación ping-pong de seis fotogramas, recortado a un círculo negro.
 * Venía de cuando el panel y la aventura eran la misma cosa.
 *
 * Ya no lo son: la plataforma la abren clientes como Peter Tours, que entran a atender su
 * WhatsApp. Su logo tiene que ser **el logo de la empresa**, no un personaje. Así que pasa
 * a ser `logo-gcc.png` —los corazones cruzados, el mismo del sitio público y del icono de
 * la pestaña— y la única animación que queda es el giro.
 *
 * De paso pesa quince veces menos y se acabaron las tres tablas de píxeles por tamaño, que
 * había que recalcular a mano cada vez que se quería un tamaño nuevo.
 *
 * Tamaños: sm (36 px), md (56 px), lg (80 px).
 */

import Image from 'next/image';

const SIZES = { sm: 36, md: 56, lg: 80 } as const;

export default function BrandLoader({
  size = 'md',
  label,
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}) {
  const px = SIZES[size];
  const pf = { fontFamily: 'var(--font-display)' } as const;

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* El giro es antihorario y lento (12 s): tiene que leerse como «sigue vivo», no
          como un reloj de arena que mete prisa. `slowSpin` está en globals.css.

          ⚠️ `motion-reduce:animate-none`: para quien pide en su sistema que no le muevan
          la interfaz, un logo girando sin parar en cada carga puede ser mareante. Se queda
          quieto y no se pierde nada — lo que informa es que el logo ESTÁ, no que gire. */}
      <div
        className="motion-reduce:animate-none shrink-0"
        style={{ width: px, height: px, animation: 'slowSpin 12s linear infinite reverse' }}
      >
        <Image
          src="/logo-gcc.png"
          alt=""
          width={px}
          height={px}
          // Es la marca: aparece en la primera pantalla y en cada carga. Que no espere turno.
          priority
          className="rounded-full select-none"
          style={{ width: px, height: px }}
        />
      </div>
      {label && (
        <p className="text-[10px] text-accent-glow opacity-60" style={pf}>
          {label}
        </p>
      )}
    </div>
  );
}
