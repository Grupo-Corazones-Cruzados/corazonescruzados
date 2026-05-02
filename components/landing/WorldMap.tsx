'use client';

export const TILE = 32;
export const MAP_COLS = 30;
export const MAP_ROWS = 22;
export const MAP_W = MAP_COLS * TILE; // 960
export const MAP_H = MAP_ROWS * TILE; // 704

type House = {
  x: number; // tile col
  y: number; // tile row
  src: string;
  wTiles: number;
  hTiles: number;
};

// Border houses — top + bottom edges, alternating two facades.
const HOUSES: House[] = [
  // Top row (y = 0)
  { x: 2, y: 0, src: '/world/house1.png', wTiles: 5, hTiles: 9 },
  { x: 9, y: 0, src: '/world/house2.png', wTiles: 4, hTiles: 9 },
  { x: 14, y: 0, src: '/world/house1.png', wTiles: 5, hTiles: 9 },
  { x: 21, y: 0, src: '/world/house2.png', wTiles: 4, hTiles: 9 },
  // Bottom row (y = MAP_ROWS - house h = 22 - 9 = 13)
  { x: 2, y: 13, src: '/world/house2.png', wTiles: 4, hTiles: 9 },
  { x: 8, y: 13, src: '/world/house1.png', wTiles: 5, hTiles: 9 },
  { x: 15, y: 13, src: '/world/house2.png', wTiles: 4, hTiles: 9 },
  { x: 21, y: 13, src: '/world/house1.png', wTiles: 5, hTiles: 9 },
];

export default function WorldMap() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: MAP_W,
        height: MAP_H,
        position: 'relative',
        backgroundImage: 'url(/world/dirt.png)',
        backgroundRepeat: 'repeat',
        backgroundSize: `${TILE}px ${TILE}px`,
        imageRendering: 'pixelated',
        boxShadow:
          'inset 0 0 0 4px rgba(0,0,0,0.5), 8px 8px 0 rgba(0,0,0,0.55)',
      }}
    >
      {HOUSES.map((h, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={h.src}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: h.x * TILE,
            top: h.y * TILE,
            width: h.wTiles * TILE,
            height: h.hTiles * TILE,
            imageRendering: 'pixelated',
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  );
}
