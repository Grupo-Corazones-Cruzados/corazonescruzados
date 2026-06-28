/**
 * EditorIcons — íconos de línea estilo Microsoft Fluent (20×20, currentColor)
 * para el editor del mundo. Reemplazan los emojis genéricos.
 */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

// Escenas (cuadrícula).
export const IconScenes = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="6" height="6" rx="1.2" />
    <rect x="11" y="3" width="6" height="6" rx="1.2" />
    <rect x="3" y="11" width="6" height="6" rx="1.2" />
    <rect x="11" y="11" width="6" height="6" rx="1.2" />
  </Svg>
);

// NPCs (personas).
export const IconNpcs = (p: P) => (
  <Svg {...p}>
    <circle cx="7.5" cy="6.5" r="2.6" />
    <path d="M3 16c0-2.5 2-4.2 4.5-4.2S12 13.5 12 16" />
    <circle cx="14" cy="7" r="2.1" />
    <path d="M13 11.9c2.2-.2 4 1.5 4 4.1" />
  </Svg>
);

// Capas / assets.
export const IconLayers = (p: P) => (
  <Svg {...p}>
    <path d="M10 3.2 17 7l-7 3.8L3 7l7-3.8Z" />
    <path d="M3.4 10.4 10 14l6.6-3.6" />
    <path d="M3.4 13.4 10 17l6.6-3.6" />
  </Svg>
);

// Mapa.
export const IconMap = (p: P) => (
  <Svg {...p}>
    <path d="M7.4 4 3 5.6v10.4L7.4 14l5.2 2 4.4-1.6V4l-4.4 1.6L7.4 4Z" />
    <path d="M7.4 4v10M12.6 6v10" />
  </Svg>
);

// Cinemática (tira de película).
export const IconFilm = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="14" height="12" rx="1.5" />
    <path d="M7 4v12M13 4v12M3 8h4M13 8h4M3 12h4M13 12h4" />
  </Svg>
);

// Añadir.
export const IconAdd = (p: P) => (
  <Svg {...p}>
    <path d="M10 4.5v11M4.5 10h11" />
  </Svg>
);

// Editar (lápiz).
export const IconEdit = (p: P) => (
  <Svg {...p}>
    <path d="M13.6 4.2 15.8 6.4 7.2 15 4 16l1-3.2 8.6-8.6Z" />
  </Svg>
);

export const IconUp = (p: P) => (
  <Svg {...p}>
    <path d="M10 15V5M5.5 9.5 10 5l4.5 4.5" />
  </Svg>
);
export const IconDown = (p: P) => (
  <Svg {...p}>
    <path d="M10 5v10M5.5 10.5 10 15l4.5-4.5" />
  </Svg>
);
export const IconLeft = (p: P) => (
  <Svg {...p}>
    <path d="M15 10H5M9.5 5.5 5 10l4.5 4.5" />
  </Svg>
);
export const IconRight = (p: P) => (
  <Svg {...p}>
    <path d="M5 10h10M10.5 5.5 15 10l-4.5 4.5" />
  </Svg>
);

// Borrar (papelera).
export const IconDelete = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 5.5h11M8 5.5V4h4v1.5M6 5.5l.7 10h6.6l.7-10M8.5 8.5v5M11.5 8.5v5" />
  </Svg>
);

// Cerrar (X).
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M5 5l10 10M15 5 5 15" />
  </Svg>
);

// Ubicación (pin).
export const IconLocation = (p: P) => (
  <Svg {...p}>
    <path d="M10 17s5-4.2 5-8a5 5 0 1 0-10 0c0 3.8 5 8 5 8Z" />
    <circle cx="10" cy="9" r="1.8" />
  </Svg>
);

// Evento (rayo).
export const IconBolt = (p: P) => (
  <Svg {...p}>
    <path d="M11 3 5 11h4l-1 6 6-8h-4l1-6Z" />
  </Svg>
);

// Advertencia.
export const IconWarning = (p: P) => (
  <Svg {...p}>
    <path d="M10 3.5 17.5 16H2.5L10 3.5Z" />
    <path d="M10 8.5v3.5M10 14h.01" />
  </Svg>
);
