/**
 * EL EMBLEMA XH — la «bandera» del proyecto (Fernando, 2026-10-26: «un icono de XH que
 * referencia a la conexión o las siglas de este proyecto… que den esa impresión de unión de
 * un grupo»). Escudo hexagonal con degradado de la marca, borde interior, las siglas en
 * blanco y un banderín que ondea encima. SVG propio: nítido a cualquier tamaño (mide en `em`).
 */
export default function EmblemaXH({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 112" className={`emblema-xh ${className}`} role="img" aria-label="XH">
      <defs>
        <linearGradient id="xh-fondo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="55%" stopColor="#a21caf" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id="xh-brillo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* El banderín, que ondea. */}
      <g className="emblema-xh-banderin">
        <rect x="48.5" y="2" width="3" height="20" rx="1.5" fill="#f5f3ff" />
        <path d="M51.5 3 C60 1, 64 7, 73 4 L73 15 C64 18, 60 12, 51.5 14 Z" fill="#f472b6" />
      </g>
      {/* El escudo hexagonal. */}
      <path d="M50 18 L90 40 L90 86 L50 108 L10 86 L10 40 Z" fill="url(#xh-fondo)" stroke="#f5f3ff" strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 26 L83 44 L83 82 L50 100 L17 82 L17 44 Z" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M50 18 L90 40 L90 60 L10 60 L10 40 Z" fill="url(#xh-brillo)" />
      <text
        x="50"
        y="74"
        textAnchor="middle"
        fontFamily="'Space Grotesk', 'Inter', system-ui, sans-serif"
        fontWeight="700"
        fontSize="34"
        letterSpacing="-1"
        fill="#ffffff"
      >
        XH
      </text>
    </svg>
  );
}
