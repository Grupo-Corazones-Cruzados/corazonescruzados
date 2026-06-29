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

// Ojo (capa visible).
export const IconEye = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 10S5 5 10 5s7.5 5 7.5 5-2.5 5-7.5 5-7.5-5-7.5-5Z" />
    <circle cx="10" cy="10" r="2.3" />
  </Svg>
);

// Ojo tachado (capa oculta).
export const IconEyeOff = (p: P) => (
  <Svg {...p}>
    <path d="M7.2 5.5A8 8 0 0 1 10 5c5 0 7.5 5 7.5 5a13 13 0 0 1-2.2 2.7" />
    <path d="M5 6.8A12.6 12.6 0 0 0 2.5 10S5 15 10 15a7.7 7.7 0 0 0 2.6-.45" />
    <path d="M8.4 8.5a2.3 2.3 0 0 0 3.1 3.3M3.5 3.5l13 13" />
  </Svg>
);

// Pincel (pintar).
export const IconBrush = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 3.8 16.2 5.5 9 12.7l-2.4.7.7-2.4 7.2-7.2Z" />
    <path d="M6.4 11.6c-1.8.5-2.6 2-2.9 3.9 1.9-.3 3.4-1.1 3.9-2.9" />
  </Svg>
);

// Goma (borrar).
export const IconEraser = (p: P) => (
  <Svg {...p}>
    <path d="M8.5 16H16M4.4 12.5l4.8-4.8 5 5-3.3 3.3H7.7L4.4 12.5Z" />
    <path d="M7.5 9.4l5 5" />
  </Svg>
);

// Copiar.
export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="7" width="9" height="9" rx="1.4" />
    <path d="M13 7V5.4A1.4 1.4 0 0 0 11.6 4H5.4A1.4 1.4 0 0 0 4 5.4v6.2A1.4 1.4 0 0 0 5.4 13H7" />
  </Svg>
);

// Colisión (muro/rejilla).
export const IconCollision = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="13" height="11" rx="1" />
    <path d="M3.5 8h13M3.5 12h13M8 4.5v3.5M12 8v4M8 12v3.5" />
  </Svg>
);

// Ver colisiones (diana).
export const IconTarget = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="6.5" />
    <circle cx="10" cy="10" r="2.4" />
  </Svg>
);

// Posición inicial (spawn).
export const IconSpawn = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="6.5" />
    <path d="M10 3.5v3M10 13.5v3M3.5 10h3M13.5 10h3" />
  </Svg>
);

// Prop / objeto (cubo).
export const IconCube = (p: P) => (
  <Svg {...p}>
    <path d="M10 3.5 16.5 7v6L10 16.5 3.5 13V7L10 3.5Z" />
    <path d="M3.5 7 10 10.5 16.5 7M10 10.5V16.5" />
  </Svg>
);

// Luz (sol).
export const IconLight = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="3.2" />
    <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" />
  </Svg>
);

// Transición (portal/flecha).
export const IconTransition = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 10h9M9 6.5 12.5 10 9 13.5" />
    <path d="M14 4.5h2.5v11H14" />
  </Svg>
);

// Guardar (disquete).
export const IconSave = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 4.5h8.6L15.5 7v8.5h-11V4.5Z" />
    <path d="M6.5 4.5v4h6v-4M7 15.5v-3.5h6v3.5" />
  </Svg>
);

// Deshacer.
export const IconUndo = (p: P) => (
  <Svg {...p}>
    <path d="M7 6 3.5 9.5 7 13" />
    <path d="M3.5 9.5H12a4 4 0 0 1 0 8h-1.5" />
  </Svg>
);

// Rehacer.
export const IconRedo = (p: P) => (
  <Svg {...p}>
    <path d="M13 6l3.5 3.5L13 13" />
    <path d="M16.5 9.5H8a4 4 0 0 0 0 8h1.5" />
  </Svg>
);

// Advertencia.
export const IconWarning = (p: P) => (
  <Svg {...p}>
    <path d="M10 3.5 17.5 16H2.5L10 3.5Z" />
    <path d="M10 8.5v3.5M10 14h.01" />
  </Svg>
);

// Voltear horizontal (espejo vertical).
export const IconFlipH = (p: P) => (
  <Svg {...p}>
    <path d="M10 3v14" strokeDasharray="2 2" />
    <path d="M6.5 7 3.5 10l3 3" />
    <path d="M13.5 7l3 3-3 3" />
  </Svg>
);
// Voltear vertical (espejo horizontal).
export const IconFlipV = (p: P) => (
  <Svg {...p}>
    <path d="M3 10h14" strokeDasharray="2 2" />
    <path d="M7 6.5 10 3.5l3 3" />
    <path d="M7 13.5l3 3 3-3" />
  </Svg>
);
// Rotar en sentido horario.
export const IconRotateCw = (p: P) => (
  <Svg {...p}>
    <path d="M15.5 9a6 6 0 1 0-1.6 5" />
    <path d="M15.5 4.5V9H11" />
  </Svg>
);
// Rotar en sentido antihorario.
export const IconRotateCcw = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 9a6 6 0 1 1 1.6 5" />
    <path d="M4.5 4.5V9H9" />
  </Svg>
);
