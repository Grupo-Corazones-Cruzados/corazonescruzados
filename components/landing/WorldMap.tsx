'use client';

import { memo, useEffect, useRef } from 'react';
import {
  SHEETS,
  TILE_PX,
  tileZ,
  drawOriented,
  type WorldMapData,
} from './world/sheets';
import { ITEMS, findItem, itemDataUrl } from './world/items';
import { loadChromaKeyedSheet } from './world/sheetLoader';

export const TILE = TILE_PX;
export const WORLD_SCALE = 2; // 1 source px → 2 screen px (matches editor)

// Memoizado: el canvas del mundo NO se vuelve a renderizar mientras el mapa /
// items recogidos no cambien, aunque el padre (CharacterGameplay) se re-renderice
// en cada frame de movimiento. Clave para mantener buenos FPS al caminar.
function WorldMap({
  map,
  scale = WORLD_SCALE,
  hidePickedItems,
  splitMode,
}: {
  map: WorldMapData;
  scale?: number;
  hidePickedItems?: Set<string>;
  // Render parcial para que el personaje pueda quedar ENTRE capas:
  //  'below' = capas hasta `map.characterLayer` (+ items/props),
  //  'above' = solo las capas POR ENCIMA de `map.characterLayer`.
  //  undefined = todas (comportamiento normal).
  splitMode?: 'below' | 'above';
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

    // Load tile sheets + item icons in parallel. Sheets pass through
    // the chroma-key loader so near-white pixels become transparent.
    const sheetPromise = Promise.all(SHEETS.map((s) => loadChromaKeyedSheet(s.url)));
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
      // Render every layer in array order (bottom to top). Within each
      // layer, two-pass on tileZ so overlay-category tiles still draw
      // above ground-category tiles painted on the same layer (e.g.
      // legacy maps that haven't been split yet).
      const drawTile = (t: {
        s: number;
        sx: number;
        sy: number;
        x: number;
        y: number;
        color?: string;
        fx?: 1;
        fy?: 1;
        rot?: number;
      }) => {
        if (t.color) {
          ctx.fillStyle = t.color;
          ctx.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);
          return;
        }
        const img = imgs[t.s];
        if (!img) return;
        drawOriented(
          ctx,
          img,
          t.sx * TILE,
          t.sy * TILE,
          TILE,
          t.x * TILE,
          t.y * TILE,
          TILE,
          !!t.fx,
          !!t.fy,
          t.rot,
        );
      };
      const layers = map.layers ?? [];
      // Índice de la capa del personaje (las de arriba lo tapan).
      const splitIdx = map.characterLayer
        ? layers.findIndex((l) => l.id === map.characterLayer)
        : -1;
      layers.forEach((layer, i) => {
        if (layer.visible === false) return;
        // 'above' dibuja solo capas por encima de la del personaje; 'below' (y
        // sin split) dibuja hasta esa capa inclusive.
        if (splitMode === 'above') {
          if (splitIdx < 0 || i <= splitIdx) return;
        } else if (splitMode === 'below' && splitIdx >= 0 && i > splitIdx) {
          return;
        }
        const tiles = layer.tiles ?? [];
        for (const t of tiles) if (tileZ(t.s) === 0) drawTile(t);
        for (const t of tiles) if (tileZ(t.s) === 1) drawTile(t);
      });
      // El paso 'above' solo dibuja capas (sin items/props).
      if (splitMode === 'above') return;
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
      // Props — non-collectible world objects. Drawn at full tile size
      // (no halo) so they read as scenery rather than loot.
      const props = map.props ?? [];
      for (const p of props) {
        const def = findItem(p.itemId);
        if (!def) continue;
        const img = itemImgs.get(def.id);
        if (!img) continue;
        ctx.drawImage(img, p.x * TILE, p.y * TILE, TILE, TILE);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [map, hidePickedItems, splitMode]);

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
  // Aggregate collision flags across every layer — a tile that's
  // marked as colliding on any layer blocks the player. Hidden
  // layers still contribute (visibility is an editor concern).
  for (const layer of map.layers ?? []) {
    for (const t of layer.tiles ?? []) {
      if (
        t.c &&
        t.x >= 0 &&
        t.x < map.width &&
        t.y >= 0 &&
        t.y < map.height
      ) {
        grid[t.y][t.x] = true;
      }
    }
  }
  for (const p of map.props ?? []) {
    if (
      p.solid &&
      p.x >= 0 &&
      p.x < map.width &&
      p.y >= 0 &&
      p.y < map.height
    ) {
      grid[p.y][p.x] = true;
    }
  }
  return grid;
}

export default memo(WorldMap);
