'use client';

import { useEffect, useRef } from 'react';
import {
  SHEETS,
  TILE_PX,
  tileZ,
  type WorldMapData,
} from './world/sheets';
import { ITEMS, findItem, itemDataUrl } from './world/items';

export const TILE = TILE_PX;
export const WORLD_SCALE = 2; // 1 source px → 2 screen px (matches editor)

export default function WorldMap({
  map,
  scale = WORLD_SCALE,
  hidePickedItems,
}: {
  map: WorldMapData;
  scale?: number;
  hidePickedItems?: Set<string>;
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let cancelled = false;

    // Load tile sheets + item icons in parallel.
    const sheetPromise = Promise.all(
      SHEETS.map(
        (s) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = s.url;
          }),
      ),
    );
    const itemImgs = new Map<string, HTMLImageElement>();
    const itemPromises = ITEMS.map(
      (it) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            itemImgs.set(it.id, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = itemDataUrl(it);
        }),
    );

    Promise.all([sheetPromise, ...itemPromises]).then((vals) => {
      if (cancelled) return;
      const imgs = vals[0] as HTMLImageElement[];
      const tiles = map.layers[0]?.tiles ?? [];
      // Two-pass render: ground (z=0) first, then overlays (z=1) on top
      // so transparent decoration / building tiles see the terrain.
      const drawTile = (t: (typeof tiles)[number]) => {
        const img = imgs[t.s];
        if (!img) return;
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
      };
      for (const t of tiles) if (tileZ(t.s) === 0) drawTile(t);
      for (const t of tiles) if (tileZ(t.s) === 1) drawTile(t);
      // Items on top of tiles.
      const items = map.items ?? [];
      for (const placement of items) {
        if (hidePickedItems?.has(placement.id)) continue;
        const def = findItem(placement.itemId);
        if (!def) continue;
        const img = itemImgs.get(def.id);
        if (!img) continue;
        // Subtle highlight beneath the item so it pops on any terrain.
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.arc(
          placement.x * TILE + TILE / 2,
          placement.y * TILE + TILE / 2 + 1,
          TILE / 2 - 4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.drawImage(
          img,
          placement.x * TILE + 4,
          placement.y * TILE + 4,
          TILE - 8,
          TILE - 8,
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [map, hidePickedItems]);

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
