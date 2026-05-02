'use client';

import { useEffect, useRef } from 'react';
import { SHEETS, TILE_PX, type WorldMapData } from './world/sheets';

export const TILE = TILE_PX;
export const WORLD_SCALE = 2; // 1 source px → 2 screen px (matches editor)

export default function WorldMap({
  map,
  scale = WORLD_SCALE,
}: {
  map: WorldMapData;
  scale?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = map.width * TILE;
    canvas.height = map.height * TILE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    // Keep the canvas transparent so empty cells show the gameplay
    // background (black) instead of a giant brown rectangle. Drawing
    // tiles fills only the cells the admin actually painted.
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let cancelled = false;
    Promise.all(
      SHEETS.map(
        (s) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = s.url;
          }),
      ),
    ).then((imgs) => {
      if (cancelled) return;
      const tiles = (map.layers[0]?.tiles ?? []);
      for (const t of tiles) {
        const img = imgs[t.s];
        if (!img) continue;
        ctx.drawImage(
          img,
          t.sx * TILE,
          t.sy * TILE,
          TILE,
          TILE,
          t.x * TILE,
          t.y * TILE,
          TILE,
          TILE,
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [map]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        imageRendering: 'pixelated',
        width: map.width * TILE * scale,
        height: map.height * TILE * scale,
      }}
    />
  );
}

export function buildCollisionGrid(
  map: WorldMapData,
): boolean[][] {
  const grid: boolean[][] = Array.from({ length: map.height }, () =>
    new Array(map.width).fill(false),
  );
  const tiles = map.layers[0]?.tiles ?? [];
  for (const t of tiles) {
    if (t.c && t.x >= 0 && t.x < map.width && t.y >= 0 && t.y < map.height) {
      grid[t.y][t.x] = true;
    }
  }
  return grid;
}
