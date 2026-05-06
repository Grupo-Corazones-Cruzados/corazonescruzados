'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORIES,
  SHEETS,
  TILE_PX,
  tileZ,
  type ItemPlacement,
  type LayerData,
  type Tile,
  type WorldMapData,
} from './sheets';
import { ITEMS, ITEM_CATEGORIES, findItem, itemDataUrl } from './items';

// One painted cell relative to the brush origin. `dx`/`dy` are tile
// offsets from the top-left of the brush rectangle.
type BrushTile = {
  dx: number;
  dy: number;
  s: number;
  sx: number;
  sy: number;
  c?: 1;
};

type Brush = {
  // Bounding box in tiles.
  w: number;
  h: number;
  // Where the cells came from. `sheet` brushes are contiguous selections
  // from a tilesheet palette; `map` brushes are arbitrary captures from
  // already-painted regions of the canvas (which can mix sheets and have
  // gaps).
  source: 'sheet' | 'map';
  // Cells to stamp.
  tiles: BrushTile[];
  // Stable key used to dedupe entries inside the history panel.
  key: string;
  // For the inline preview shown next to the toolbar — only set on
  // `sheet` brushes since they map to a single source rectangle.
  sheetIdx?: number;
  sx?: number;
  sy?: number;
};

function sheetBrush(
  sheetIdx: number,
  sx: number,
  sy: number,
  w: number,
  h: number,
): Brush {
  const tiles: BrushTile[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      tiles.push({ dx, dy, s: sheetIdx, sx: sx + dx, sy: sy + dy });
    }
  }
  return {
    w,
    h,
    source: 'sheet',
    tiles,
    key: `sheet:${sheetIdx}:${sx}:${sy}:${w}:${h}`,
    sheetIdx,
    sx,
    sy,
  };
}

function mapBrush(
  originX: number,
  originY: number,
  w: number,
  h: number,
  allTiles: Tile[],
): Brush {
  const tiles: BrushTile[] = [];
  for (const t of allTiles) {
    if (
      t.x >= originX &&
      t.x < originX + w &&
      t.y >= originY &&
      t.y < originY + h
    ) {
      const cell: BrushTile = {
        dx: t.x - originX,
        dy: t.y - originY,
        s: t.s,
        sx: t.sx,
        sy: t.sy,
      };
      if (t.c) cell.c = 1;
      tiles.push(cell);
    }
  }
  // Capture order doesn't matter for dedup — the captured payload itself
  // is the identity.
  const sig = tiles
    .map((c) => `${c.dx},${c.dy},${c.s},${c.sx},${c.sy},${c.c ?? 0}`)
    .join('|');
  return {
    w,
    h,
    source: 'map',
    tiles,
    key: `map:${w}x${h}:${sig}`,
  };
}

const VIEW_SCALE = 2; // 1 source px = 2 screen px in editor

export default function MapEditor({
  initialMap,
  onClose,
  onSaved,
}: {
  initialMap: WorldMapData;
  onClose: () => void;
  onSaved: (map: WorldMapData) => void;
}) {
  const [width, setWidth] = useState(initialMap.width);
  const [height, setHeight] = useState(initialMap.height);
  const [tiles, setTiles] = useState<Tile[]>(
    initialMap.layers[0]?.tiles ?? [],
  );
  const [brush, setBrush] = useState<Brush | null>(null);
  // Mutually-exclusive editor modes. `paint` lays tiles (no collision
  // baked in); `collision` toggles the c flag on existing tiles;
  // `erase` removes the top-most thing; `spawn` sets the player spawn;
  // `copy` lets the user drag a rectangle on the canvas to capture the
  // already-painted region as a reusable brush.
  type EditorMode = 'paint' | 'collision' | 'erase' | 'spawn' | 'copy';
  const [mode, setMode] = useState<EditorMode>('paint');
  const [brushHistory, setBrushHistory] = useState<Brush[]>([]);
  // Layer focus controls. `activeLayer` null = work on every layer
  // (current behavior); 0 isolates the ground layer (terreno / agua),
  // 1 isolates the overlay (decoracion / edificios / interiores).
  // Tiles outside the active layer dim to 0.3 alpha so the user can
  // still see the surrounding map without losing focus. Visibility
  // toggles hide a layer entirely.
  const [activeLayer, setActiveLayer] = useState<0 | 1 | null>(null);
  const [layer0Visible, setLayer0Visible] = useState(true);
  const [layer1Visible, setLayer1Visible] = useState(true);
  // Cells under the cursor while painting / copying — used both for the
  // copy-rectangle overlay and for the paint hover preview.
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [copyDrag, setCopyDrag] = useState<{
    start: { x: number; y: number };
    now: { x: number; y: number };
  } | null>(null);
  const [spawnX, setSpawnX] = useState(initialMap.spawnX ?? 0);
  const [spawnY, setSpawnY] = useState(initialMap.spawnY ?? 0);
  const [items, setItems] = useState<ItemPlacement[]>(
    initialMap.items ?? [],
  );
  const [itemBrush, setItemBrush] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tiles' | 'items'>('tiles');
  // Tracks the last cell affected by the current drag so that
  // collision-mode toggling doesn't flip the same cell back-and-forth
  // while the cursor sits on it.
  const lastDragCellRef = useRef<{ x: number; y: number } | null>(null);

  // ── Undo / redo history ────────────────────────────────────────
  type Snapshot = {
    tiles: Tile[];
    items: ItemPlacement[];
    width: number;
    height: number;
    spawnX: number;
    spawnY: number;
  };
  const initSnap: Snapshot = useMemo(
    () => ({
      tiles: initialMap.layers[0]?.tiles ?? [],
      items: initialMap.items ?? [],
      width: initialMap.width,
      height: initialMap.height,
      spawnX: initialMap.spawnX ?? 0,
      spawnY: initialMap.spawnY ?? 0,
    }),
    [initialMap],
  );
  const [history, setHistory] = useState<Snapshot[]>([initSnap]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const restoringRef = useRef(false);

  const snapKey = (s: Snapshot) =>
    `${s.width}x${s.height}|${s.spawnX},${s.spawnY}|${JSON.stringify(s.tiles)}|${JSON.stringify(s.items)}`;

  const pushHistory = () => {
    if (restoringRef.current) return;
    const snap: Snapshot = {
      tiles,
      items,
      width,
      height,
      spawnX,
      spawnY,
    };
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIdx + 1);
      const last = truncated[truncated.length - 1];
      if (last && snapKey(last) === snapKey(snap)) return prev;
      const next = [...truncated, snap];
      // Cap at 100 entries to keep memory bounded.
      const trimmed = next.length > 100 ? next.slice(next.length - 100) : next;
      setHistoryIdx(trimmed.length - 1);
      return trimmed;
    });
  };

  const restore = (s: Snapshot) => {
    restoringRef.current = true;
    setTiles(s.tiles);
    setItems(s.items);
    setWidth(s.width);
    setHeight(s.height);
    setSpawnX(s.spawnX);
    setSpawnY(s.spawnY);
    // Release the guard on the next tick so dependent effects run free.
    setTimeout(() => {
      restoringRef.current = false;
    }, 0);
  };

  const undo = () => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    restore(history[newIdx]);
  };
  const redo = () => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    restore(history[newIdx]);
  };

  // Keyboard shortcuts.
  //   Q/W/E/R: switch mode (paint / collision / erase / spawn).
  //   1: toggle showCollisions.
  //   A / S: undo / redo.
  //   ⌘S / Ctrl+S: save the map.
  //   ⌘Z / Ctrl+Z (+ Shift / Y): undo / redo with the platform combo.
  // Inputs stay focusable — typing in the width/height boxes won't
  // trigger any of this. `save` is read through a ref because it's
  // declared later in the component.
  const saveRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const k = typeof e.key === 'string' ? e.key.toLowerCase() : '';
      const meta = e.metaKey || e.ctrlKey;
      if (meta) {
        if (k === 's') {
          e.preventDefault();
          saveRef.current();
        } else if (k === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((k === 'z' && e.shiftKey) || k === 'y') {
          e.preventDefault();
          redo();
        }
        return;
      }
      switch (k) {
        case 'q':
          e.preventDefault();
          setMode('paint');
          return;
        case 'w':
          e.preventDefault();
          setMode('collision');
          return;
        case 'e':
          e.preventDefault();
          setMode('erase');
          return;
        case 'r':
          e.preventDefault();
          setMode('spawn');
          return;
        case 'c':
          e.preventDefault();
          setMode('copy');
          return;
        case '1':
          e.preventDefault();
          setShowCollisions((v) => !v);
          return;
        case 'a':
          e.preventDefault();
          undo();
          return;
        case 's':
          e.preventDefault();
          redo();
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIdx, history]);
  const [activeCategory, setActiveCategory] = useState<
    (typeof CATEGORIES)[number]['id']
  >('terreno');
  const [search, setSearch] = useState('');
  const [showCollisions, setShowCollisions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Map -> { "x,y": index in tiles[] } for fast paint replacement.
  const tileIdxByCell = useMemo(() => {
    const m = new Map<string, number>();
    tiles.forEach((t, i) => m.set(`${t.x},${t.y}`, i));
    return m;
  }, [tiles]);

  // ── Sheets pre-load ────────────────────────────────────────────
  const [imgs, setImgs] = useState<(HTMLImageElement | null)[]>(
    () => SHEETS.map(() => null),
  );
  const [itemImgs, setItemImgs] = useState<Map<string, HTMLImageElement>>(
    () => new Map(),
  );
  useEffect(() => {
    const map = new Map<string, HTMLImageElement>();
    for (const it of ITEMS) {
      const img = new Image();
      img.src = itemDataUrl(it);
      map.set(it.id, img);
    }
    setItemImgs(map);
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      SHEETS.map(
        (s) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = s.url;
          }),
      ),
    ).then((loaded) => {
      if (!cancelled) setImgs(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Canvas render ──────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width * TILE_PX;
    canvas.height = height * TILE_PX;
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.imageSmoothingEnabled = false;
    // background = grid
    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Compute the alpha each layer renders at so that hiding / focusing
    // a layer is purely a visualization concern — the map data isn't
    // mutated, just the editor's view of it.
    const alphaForLayer = (z: 0 | 1) => {
      const visible = z === 0 ? layer0Visible : layer1Visible;
      if (!visible) return 0;
      if (activeLayer == null) return 1;
      return activeLayer === z ? 1 : 0.3;
    };
    const a0 = alphaForLayer(0);
    const a1 = alphaForLayer(1);

    // Two-pass render: ground (z=0) first, then overlay (z=1) on top.
    const drawTile = (t: Tile, alpha: number) => {
      const sheet = SHEETS[t.s];
      const img = imgs[t.s];
      if (!sheet || !img) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(
        img,
        t.sx * TILE_PX,
        t.sy * TILE_PX,
        TILE_PX,
        TILE_PX,
        t.x * TILE_PX,
        t.y * TILE_PX,
        TILE_PX,
        TILE_PX,
      );
      if (t.c && showCollisions) {
        ctx.fillStyle = 'rgba(255, 60, 60, 0.32)';
        ctx.fillRect(
          t.x * TILE_PX,
          t.y * TILE_PX,
          TILE_PX,
          TILE_PX,
        );
        ctx.strokeStyle = 'rgba(255,60,60,0.85)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          t.x * TILE_PX + 0.5,
          t.y * TILE_PX + 0.5,
          TILE_PX - 1,
          TILE_PX - 1,
        );
      }
      ctx.globalAlpha = 1;
    };
    if (a0 > 0) {
      for (const t of tiles) if (tileZ(t.s) === 0) drawTile(t, a0);
    }
    if (a1 > 0) {
      for (const t of tiles) if (tileZ(t.s) === 1) drawTile(t, a1);
    }

    // grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * TILE_PX + 0.5, 0);
      ctx.lineTo(x * TILE_PX + 0.5, height * TILE_PX);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * TILE_PX + 0.5);
      ctx.lineTo(width * TILE_PX, y * TILE_PX + 0.5);
      ctx.stroke();
    }

    // Items overlay
    for (const placement of items) {
      const def = findItem(placement.itemId);
      if (!def) continue;
      // Draw a light tile background so items pop against terrain.
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(
        placement.x * TILE_PX,
        placement.y * TILE_PX,
        TILE_PX,
        TILE_PX,
      );
      const img = itemImgs.get(def.id);
      if (img && img.complete) {
        ctx.drawImage(
          img,
          placement.x * TILE_PX + 4,
          placement.y * TILE_PX + 4,
          TILE_PX - 8,
          TILE_PX - 8,
        );
      }
    }

    // Spawn marker — green star + ring
    if (
      spawnX >= 0 &&
      spawnY >= 0 &&
      spawnX < width &&
      spawnY < height
    ) {
      const cx = spawnX * TILE_PX + TILE_PX / 2;
      const cy = spawnY * TILE_PX + TILE_PX / 2;
      ctx.fillStyle = 'rgba(60, 200, 90, 0.4)';
      ctx.fillRect(spawnX * TILE_PX, spawnY * TILE_PX, TILE_PX, TILE_PX);
      ctx.strokeStyle = '#3bd16f';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        spawnX * TILE_PX + 1,
        spawnY * TILE_PX + 1,
        TILE_PX - 2,
        TILE_PX - 2,
      );
      ctx.beginPath();
      ctx.fillStyle = '#3bd16f';
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0a14';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', cx, cy + 1);
    }
  }, [
    tiles,
    items,
    imgs,
    width,
    height,
    showCollisions,
    spawnX,
    spawnY,
    itemImgs,
    activeLayer,
    layer0Visible,
    layer1Visible,
  ]);

  // ── Brush activation + history ──────────────────────────────────
  // Anything that becomes the active brush also lands at the top of
  // the right-side history panel. Sheet brushes dedupe by their key
  // (so re-picking the same selection doesn't pile up duplicates);
  // map captures get a unique key and always join the history.
  const HISTORY_LIMIT = 30;
  const activateBrush = (b: Brush) => {
    setBrush(b);
    setMode('paint');
    setBrushHistory((prev) => {
      const without = prev.filter((p) => p.key !== b.key);
      const next = [b, ...without];
      return next.length > HISTORY_LIMIT ? next.slice(0, HISTORY_LIMIT) : next;
    });
  };

  // ── Painting ──────────────────────────────────────────────────
  const paintingRef = useRef(false);

  // Convert a client (mouse) coordinate to a tile coord on the canvas.
  // Returns null if outside the map.
  const cellFromClient = (
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cx = Math.floor((clientX - rect.left) / (TILE_PX * VIEW_SCALE));
    const cy = Math.floor((clientY - rect.top) / (TILE_PX * VIEW_SCALE));
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return null;
    return { x: cx, y: cy };
  };

  const paintAt = (clientX: number, clientY: number) => {
    const cell = cellFromClient(clientX, clientY);
    if (!cell) return;
    const cx = cell.x;
    const cy = cell.y;

    if (mode === 'spawn') {
      if (cx === spawnX && cy === spawnY) return;
      setSpawnX(cx);
      setSpawnY(cy);
      // Defer push so the state has time to settle.
      window.setTimeout(pushHistory, 0);
      return;
    }
    if (mode === 'erase') {
      // Erase target depends on the layer focus. With a layer pinned,
      // only that layer is touched (so you can wipe overlay decoration
      // without disturbing the grass underneath, and vice versa). With
      // no layer pinned, peel the top-most thing: items first, then
      // overlay tiles, then ground.
      if (activeLayer == null) {
        const itemIdx = items.findIndex((it) => it.x === cx && it.y === cy);
        if (itemIdx >= 0) {
          setItems((prev) => prev.filter((_, i) => i !== itemIdx));
          return;
        }
      }
      setTiles((prev) => {
        let target = -1;
        let bestZ = -1;
        prev.forEach((t, i) => {
          if (t.x !== cx || t.y !== cy) return;
          const z = tileZ(t.s);
          if (activeLayer != null && z !== activeLayer) return;
          if (z > bestZ) {
            bestZ = z;
            target = i;
          }
        });
        if (target < 0) return prev;
        return prev.filter((_, i) => i !== target);
      });
      return;
    }
    if (mode === 'collision') {
      // Toggle the c flag on the top-most tile at (cx, cy) — but
      // restricted to the active layer when one is pinned. During a
      // drag, skip cells we just toggled so the same cell doesn't
      // flip on every mousemove tick.
      const last = lastDragCellRef.current;
      if (last && last.x === cx && last.y === cy) return;
      lastDragCellRef.current = { x: cx, y: cy };
      setTiles((prev) => {
        let target = -1;
        let bestZ = -1;
        prev.forEach((t, i) => {
          if (t.x !== cx || t.y !== cy) return;
          const z = tileZ(t.s);
          if (activeLayer != null && z !== activeLayer) return;
          if (z > bestZ) {
            bestZ = z;
            target = i;
          }
        });
        if (target < 0) return prev;
        const next = prev.slice();
        const t = next[target];
        const flipped: Tile = { ...t };
        if (t.c) delete flipped.c;
        else flipped.c = 1;
        next[target] = flipped;
        return next;
      });
      return;
    }
    if (activeTab === 'items' && itemBrush) {
      // Replace any existing item at this cell.
      const without = items.filter((it) => !(it.x === cx && it.y === cy));
      const newItem: ItemPlacement = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        itemId: itemBrush,
        x: cx,
        y: cy,
      };
      setItems([...without, newItem]);
      return;
    }
    if (!brush) return;
    // Stamp every cell in the brush starting at (cx, cy). Each painted
    // cell only replaces the existing tile at the SAME z-layer, so
    // dropping a building on grass leaves the grass intact underneath.
    // Collision flags from the brush carry through (so a copied region
    // keeps its collisions); existing collisions are preserved when a
    // new tile lands on top.
    setTiles((prev) => {
      let next = prev;
      let mutated = false;
      for (const bt of brush.tiles) {
        const tx = cx + bt.dx;
        const ty = cy + bt.dy;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        const z = tileZ(bt.s);
        const newTile: Tile = {
          x: tx,
          y: ty,
          s: bt.s,
          sx: bt.sx,
          sy: bt.sy,
        };
        if (bt.c) newTile.c = 1;
        const idx = next.findIndex(
          (t) => t.x === tx && t.y === ty && tileZ(t.s) === z,
        );
        if (idx >= 0) {
          if (!mutated) {
            next = next.slice();
            mutated = true;
          }
          if (next[idx].c && !newTile.c) newTile.c = 1;
          next[idx] = newTile;
        } else {
          if (!mutated) {
            next = next.slice();
            mutated = true;
          }
          next.push(newTile);
        }
      }
      return next;
    });
  };

  // ── Save ──────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    try {
      const layers: LayerData[] = [{ tiles }];
      const r = await fetch('/api/world/map', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          width,
          height,
          layers,
          items,
          spawnX,
          spawnY,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j?.error ?? 'No se pudo guardar');
        return;
      }
      setSavedAt(Date.now());
      onSaved({
        name: 'default',
        width,
        height,
        layers,
        items,
        spawnX,
        spawnY,
      });
    } finally {
      setSaving(false);
    }
  };
  // Keep the save function reference fresh for the ⌘S handler.
  useEffect(() => {
    saveRef.current = save;
  });

  // ── Palette ────────────────────────────────────────────────────
  const visibleSheets = SHEETS.filter((s) => s.category === activeCategory);
  const filteredQuery = search.trim().toLowerCase();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200000,
        background: '#0a0a14',
        color: '#e5e5e5',
        fontFamily: "'Silkscreen', cursive",
        display: 'grid',
        gridTemplateColumns: '300px 1fr 220px',
        animation: 'pixelFadeIn 0.4s ease-out',
      }}
    >
      {/* ── Side panel ── */}
      <aside
        style={{
          background: '#131923',
          borderRight: '2px solid var(--color-accent)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '14px 14px 8px',
            borderBottom: '2px solid rgba(75,45,142,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: '0.9rem',
              letterSpacing: '0.22em',
              color: 'var(--color-accent)',
              textTransform: 'uppercase',
            }}
          >
            Editor del mundo
          </div>
          <input
            type="text"
            placeholder="Buscar (sheet, categoría)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '8px 10px',
              background: '#0f1320',
              border: '2px solid var(--color-accent)',
              color: '#e5e5e5',
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.7rem',
              outline: 'none',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '8px 10px 4px',
            borderBottom: '1px solid rgba(75,45,142,0.3)',
          }}
        >
          {(['tiles', 'items'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setActiveTab(t);
                if (t === 'items') setBrush(null);
                else setItemBrush(null);
              }}
              style={{
                flex: 1,
                padding: '6px 8px',
                background:
                  activeTab === t ? 'var(--color-accent)' : '#1a1a1a',
                color: activeTab === t ? '#0a0a14' : '#e5e5e5',
                border: '2px solid var(--color-accent)',
                fontFamily: "'Silkscreen', cursive",
                fontSize: '0.6rem',
                letterSpacing: '0.12em',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {t === 'tiles' ? 'Tiles' : 'Items'}
            </button>
          ))}
        </div>

        {activeTab === 'tiles' && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            padding: 10,
            borderBottom: '2px solid rgba(75,45,142,0.4)',
          }}
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              style={{
                padding: '5px 8px',
                background:
                  activeCategory === c.id ? 'var(--color-accent)' : '#1a1a1a',
                color: activeCategory === c.id ? '#0a0a14' : '#e5e5e5',
                border: '2px solid var(--color-accent)',
                fontFamily: "'Silkscreen', cursive",
                fontSize: '0.55rem',
                letterSpacing: '0.08em',
                cursor: 'pointer',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        )}

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {activeTab === 'items' &&
            ITEM_CATEGORIES.map((cat) => {
              const itemsInCat = ITEMS.filter(
                (it) =>
                  it.category === cat.id &&
                  (!filteredQuery ||
                    it.label.toLowerCase().includes(filteredQuery) ||
                    it.id.toLowerCase().includes(filteredQuery)),
              );
              if (itemsInCat.length === 0) return null;
              return (
                <div key={cat.id}>
                  <div
                    style={{
                      fontSize: '0.55rem',
                      letterSpacing: '0.16em',
                      color: 'rgba(225,215,255,0.65)',
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    {cat.label}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, 48px)',
                      gap: 6,
                    }}
                  >
                    {itemsInCat.map((it) => {
                      const active = itemBrush === it.id;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => {
                            setItemBrush(it.id);
                            setMode('paint');
                          }}
                          title={it.label}
                          style={{
                            width: 48,
                            height: 48,
                            background: '#0a0a14',
                            border: active
                              ? '2px solid #ffcc00'
                              : '2px solid rgba(75,45,142,0.5)',
                            cursor: 'pointer',
                            padding: 4,
                            boxShadow: active
                              ? '0 0 8px #ffcc00'
                              : 'none',
                          }}
                        >
                          <img
                            src={itemDataUrl(it)}
                            alt={it.label}
                            style={{
                              width: '100%',
                              height: '100%',
                              imageRendering: 'pixelated',
                              display: 'block',
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          {activeTab === 'tiles' &&
            visibleSheets
            .filter(
              (s) =>
                !filteredQuery ||
                s.name.toLowerCase().includes(filteredQuery) ||
                s.id.toLowerCase().includes(filteredQuery) ||
                s.category.toLowerCase().includes(filteredQuery),
            )
            .map((sheet) => {
              const sheetIdx = SHEETS.indexOf(sheet);
              return (
                <div key={sheet.id}>
                  <div
                    style={{
                      fontSize: '0.55rem',
                      letterSpacing: '0.16em',
                      color: 'rgba(225,215,255,0.65)',
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    {sheet.name} · {sheet.cols}×{sheet.rows}
                  </div>
                  <SheetPalette
                    sheet={sheet}
                    sheetIdx={sheetIdx}
                    selected={
                      brush?.source === 'sheet' &&
                      brush.sheetIdx === sheetIdx &&
                      brush.sx != null &&
                      brush.sy != null
                        ? { sx: brush.sx, sy: brush.sy, w: brush.w, h: brush.h }
                        : null
                    }
                    onPick={(b) => {
                      activateBrush(b);
                    }}
                  />
                </div>
              );
            })}
        </div>
      </aside>

      {/* ── Main editor area ── */}
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          // Without min-width: 0 a wide canvas inside this 1fr column
          // would push the column past its track and shove the right
          // history panel off-screen.
          minWidth: 0,
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '2px solid rgba(75,45,142,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            background: '#0f1320',
          }}
        >
          <ToolbarLabel>Tamaño</ToolbarLabel>
          <NumberInput
            value={width}
            min={5}
            max={500}
            onChange={setWidth}
            onCommit={pushHistory}
          />
          <span style={{ color: 'rgba(225,215,255,0.5)' }}>×</span>
          <NumberInput
            value={height}
            min={5}
            max={500}
            onChange={setHeight}
            onCommit={pushHistory}
          />

          <Sep />

          <IconButton
            icon="✎"
            hotkey="Q"
            label="Pintar"
            active={mode === 'paint'}
            onClick={() => setMode('paint')}
          />
          <IconButton
            icon="▥"
            hotkey="W"
            label="Colisión (clic en tile pintado)"
            active={mode === 'collision'}
            onClick={() => setMode('collision')}
          />
          <IconButton
            icon="✕"
            hotkey="E"
            label="Borrar"
            active={mode === 'erase'}
            onClick={() => setMode('erase')}
          />
          <IconButton
            icon="◎"
            hotkey="R"
            label="Posición inicial"
            active={mode === 'spawn'}
            onClick={() => setMode('spawn')}
          />
          <IconButton
            icon="▭"
            hotkey="C"
            label="Copiar región del mapa"
            active={mode === 'copy'}
            onClick={() => setMode('copy')}
          />

          <Sep />

          <IconButton
            icon="◉"
            hotkey="1"
            label="Mostrar colisiones"
            active={showCollisions}
            onClick={() => setShowCollisions((v) => !v)}
          />

          <Sep />

          {/* Layer focus + visibility. Active-layer chip dims the
              other layers; the eye toggles hide a layer entirely. */}
          <ToolbarLabel>Capa</ToolbarLabel>
          <LayerChip
            label="Todo"
            active={activeLayer == null}
            onClick={() => setActiveLayer(null)}
          />
          <LayerChip
            label="Suelo"
            active={activeLayer === 0}
            onClick={() => setActiveLayer(0)}
          />
          <LayerChip
            label="Overlay"
            active={activeLayer === 1}
            onClick={() => setActiveLayer(1)}
          />
          <IconButton
            icon={layer0Visible ? '◐' : '○'}
            hotkey=""
            label="Mostrar / ocultar suelo"
            active={layer0Visible}
            onClick={() => setLayer0Visible((v) => !v)}
          />
          <IconButton
            icon={layer1Visible ? '◑' : '○'}
            hotkey=""
            label="Mostrar / ocultar overlay"
            active={layer1Visible}
            onClick={() => setLayer1Visible((v) => !v)}
          />

          <Sep />

          <IconButton
            icon="↶"
            hotkey="A"
            label="Deshacer"
            disabled={historyIdx <= 0}
            onClick={undo}
          />
          <IconButton
            icon="↷"
            hotkey="S"
            label="Rehacer"
            disabled={historyIdx >= history.length - 1}
            onClick={redo}
          />

          <Sep />

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="pixel-btn pixel-btn-primary"
            title="Guardar (⌘S / Ctrl+S)"
            style={{ padding: '6px 14px', fontSize: '0.62rem' }}
          >
            {saving ? 'Guardando…' : 'Guardar (⌘S)'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn pixel-btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.62rem' }}
          >
            Salir del editor
          </button>
          {savedAt && (
            <span
              style={{
                fontSize: '0.55rem',
                color: 'rgba(150,220,150,0.85)',
                letterSpacing: '0.12em',
                marginLeft: 'auto',
              }}
            >
              ✓ Guardado
            </span>
          )}
          {brush && mode === 'paint' && (
            <BrushPreview brush={brush} imgs={imgs} />
          )}
          {mode === 'erase' && (
            <span
              style={{
                fontSize: '0.55rem',
                color: '#ff8080',
                letterSpacing: '0.1em',
              }}
            >
              ✕ MODO BORRAR
            </span>
          )}
          {mode === 'collision' && (
            <span
              style={{
                fontSize: '0.55rem',
                color: '#ff8080',
                letterSpacing: '0.1em',
              }}
            >
              ▥ MODO COLISIÓN · clic en tile pintado
            </span>
          )}
          {mode === 'spawn' && (
            <span
              style={{
                fontSize: '0.55rem',
                color: '#3bd16f',
                letterSpacing: '0.1em',
              }}
            >
              ◎ MODO POSICIÓN INICIAL · ({spawnX},{spawnY})
            </span>
          )}
          {mode === 'copy' && (
            <span
              style={{
                fontSize: '0.55rem',
                color: '#9bd1ff',
                letterSpacing: '0.1em',
              }}
            >
              ▭ MODO COPIAR · arrastra para capturar una región
            </span>
          )}
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#05060d',
            padding: 24,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: width * TILE_PX * VIEW_SCALE,
              height: height * TILE_PX * VIEW_SCALE,
            }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={(e) => {
                if (mode === 'copy') {
                  const c = cellFromClient(e.clientX, e.clientY);
                  if (!c) return;
                  setCopyDrag({ start: c, now: c });
                  return;
                }
                paintingRef.current = true;
                lastDragCellRef.current = null;
                paintAt(e.clientX, e.clientY);
              }}
              onMouseUp={() => {
                if (mode === 'copy' && copyDrag) {
                  const { start, now } = copyDrag;
                  const ox = Math.min(start.x, now.x);
                  const oy = Math.min(start.y, now.y);
                  const w = Math.abs(now.x - start.x) + 1;
                  const h = Math.abs(now.y - start.y) + 1;
                  const captured = mapBrush(ox, oy, w, h, tiles);
                  setCopyDrag(null);
                  if (captured.tiles.length > 0) {
                    activateBrush(captured);
                  }
                  return;
                }
                if (paintingRef.current) {
                  paintingRef.current = false;
                  lastDragCellRef.current = null;
                  pushHistory();
                }
              }}
              onMouseLeave={() => {
                setHoverCell(null);
                if (mode === 'copy') {
                  setCopyDrag(null);
                  return;
                }
                if (paintingRef.current) {
                  paintingRef.current = false;
                  lastDragCellRef.current = null;
                  pushHistory();
                }
              }}
              onMouseMove={(e) => {
                const c = cellFromClient(e.clientX, e.clientY);
                if (c) setHoverCell(c);
                if (mode === 'copy') {
                  if (c && copyDrag) setCopyDrag({ ...copyDrag, now: c });
                  return;
                }
                if (paintingRef.current) paintAt(e.clientX, e.clientY);
              }}
              style={{
                imageRendering: 'pixelated',
                width: width * TILE_PX * VIEW_SCALE,
                height: height * TILE_PX * VIEW_SCALE,
                cursor:
                  mode === 'erase'
                    ? 'not-allowed'
                    : mode === 'spawn'
                      ? 'cell'
                      : mode === 'copy' || mode === 'collision'
                        ? 'crosshair'
                        : brush
                          ? 'crosshair'
                          : 'default',
                boxShadow: '6px 6px 0 rgba(0,0,0,0.5)',
                display: 'block',
              }}
            />
            {/* Hover preview overlay — pinned over the main canvas. Shows
                a transparent ghost of the brush in paint mode, and the
                in-progress selection rectangle in copy mode. */}
            <PreviewOverlay
              brush={brush}
              mode={mode}
              hoverCell={hoverCell}
              copyDrag={copyDrag}
              imgs={imgs}
              width={width}
              height={height}
            />
          </div>
        </div>
      </main>

      {/* ── Right panel: brush history ── */}
      <aside
        style={{
          background: '#131923',
          borderLeft: '2px solid var(--color-accent)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '14px 14px 8px',
            borderBottom: '2px solid rgba(75,45,142,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: '0.85rem',
              letterSpacing: '0.2em',
              color: 'var(--color-accent)',
              textTransform: 'uppercase',
            }}
          >
            Historial
          </div>
          <div
            style={{
              fontSize: '0.5rem',
              letterSpacing: '0.12em',
              color: 'rgba(225,215,255,0.5)',
            }}
          >
            Brochas usadas (palette + copia)
          </div>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {brushHistory.length === 0 ? (
            <div
              style={{
                fontSize: '0.55rem',
                color: 'rgba(225,215,255,0.4)',
                textAlign: 'center',
                padding: '12px 4px',
              }}
            >
              Aún no has usado ninguna brocha
            </div>
          ) : (
            brushHistory.map((b) => {
              const active = brush?.key === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => activateBrush(b)}
                  title={
                    b.source === 'sheet' && b.sheetIdx != null
                      ? `${SHEETS[b.sheetIdx].id} ${b.w}×${b.h}`
                      : `Copia del mapa ${b.w}×${b.h}`
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: 6,
                    background: active ? 'var(--color-accent)' : '#1a1a1a',
                    color: active ? '#0a0a14' : '#e5e5e5',
                    border: '2px solid var(--color-accent)',
                    cursor: 'pointer',
                    fontFamily: "'Silkscreen', cursive",
                    fontSize: '0.5rem',
                    letterSpacing: '0.05em',
                    textAlign: 'left',
                  }}
                >
                  <BrushThumbnail
                    brush={b}
                    imgs={imgs}
                    tileSize={Math.max(
                      4,
                      Math.min(10, Math.floor(60 / Math.max(b.w, b.h))),
                    )}
                  />
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ opacity: 0.85 }}>
                      {b.source === 'sheet' ? 'palette' : 'mapa'}
                    </span>
                    <span style={{ fontSize: '0.55rem' }}>
                      {b.w}×{b.h}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}

function SheetPalette({
  sheet,
  sheetIdx,
  selected,
  onPick,
}: {
  sheet: (typeof SHEETS)[number];
  sheetIdx: number;
  selected: { sx: number; sy: number; w: number; h: number } | null;
  onPick: (b: Brush) => void;
}) {
  const PALETTE_TILE = 24;
  const [dragStart, setDragStart] = useState<{ sx: number; sy: number } | null>(
    null,
  );
  const [dragNow, setDragNow] = useState<{ sx: number; sy: number } | null>(
    null,
  );

  const cellAt = (e: React.MouseEvent, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const sx = Math.floor((e.clientX - rect.left) / PALETTE_TILE);
    const sy = Math.floor((e.clientY - rect.top) / PALETTE_TILE);
    if (sx < 0 || sy < 0 || sx >= sheet.cols || sy >= sheet.rows) return null;
    return { sx, sy };
  };

  // Highlight rectangle: live drag if dragging, otherwise the saved
  // brush selection (when this palette matches the active sheet).
  const highlight = dragStart && dragNow
    ? {
        sx: Math.min(dragStart.sx, dragNow.sx),
        sy: Math.min(dragStart.sy, dragNow.sy),
        w: Math.abs(dragNow.sx - dragStart.sx) + 1,
        h: Math.abs(dragNow.sy - dragStart.sy) + 1,
      }
    : selected
      ? { sx: selected.sx, sy: selected.sy, w: selected.w, h: selected.h }
      : null;

  return (
    <div
      style={{
        position: 'relative',
        width: sheet.cols * PALETTE_TILE,
        maxWidth: '100%',
        background: '#0a0a14',
        border: '1px solid rgba(75,45,142,0.4)',
        backgroundImage: `url(${sheet.url})`,
        backgroundSize: `${sheet.cols * PALETTE_TILE}px ${sheet.rows * PALETTE_TILE}px`,
        imageRendering: 'pixelated',
        height: sheet.rows * PALETTE_TILE,
        cursor: 'crosshair',
        userSelect: 'none',
      }}
      onMouseDown={(e) => {
        const c = cellAt(e, e.currentTarget as HTMLDivElement);
        if (!c) return;
        setDragStart(c);
        setDragNow(c);
      }}
      onMouseMove={(e) => {
        if (!dragStart) return;
        const c = cellAt(e, e.currentTarget as HTMLDivElement);
        if (c) setDragNow(c);
      }}
      onMouseUp={() => {
        if (!dragStart || !dragNow) {
          setDragStart(null);
          setDragNow(null);
          return;
        }
        const sx = Math.min(dragStart.sx, dragNow.sx);
        const sy = Math.min(dragStart.sy, dragNow.sy);
        const w = Math.abs(dragNow.sx - dragStart.sx) + 1;
        const h = Math.abs(dragNow.sy - dragStart.sy) + 1;
        onPick(sheetBrush(sheetIdx, sx, sy, w, h));
        setDragStart(null);
        setDragNow(null);
      }}
      onMouseLeave={() => {
        if (dragStart && dragNow) {
          const sx = Math.min(dragStart.sx, dragNow.sx);
          const sy = Math.min(dragStart.sy, dragNow.sy);
          const w = Math.abs(dragNow.sx - dragStart.sx) + 1;
          const h = Math.abs(dragNow.sy - dragStart.sy) + 1;
          onPick(sheetBrush(sheetIdx, sx, sy, w, h));
        }
        setDragStart(null);
        setDragNow(null);
      }}
    >
      {highlight && (
        <div
          style={{
            position: 'absolute',
            left: highlight.sx * PALETTE_TILE,
            top: highlight.sy * PALETTE_TILE,
            width: highlight.w * PALETTE_TILE,
            height: highlight.h * PALETTE_TILE,
            border: '2px solid #ffcc00',
            boxShadow: '0 0 6px #ffcc00',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

// Overlay canvas pinned at (0, 0) over the editor canvas. It draws a
// translucent ghost of the active brush at the cursor cell while in
// paint mode, and a yellow selection rectangle while dragging in copy
// mode. The container's CSS scaling stretches it to match the visible
// editor canvas size, so the math stays in source pixels.
function PreviewOverlay({
  brush,
  mode,
  hoverCell,
  copyDrag,
  imgs,
  width,
  height,
}: {
  brush: Brush | null;
  mode: 'paint' | 'collision' | 'erase' | 'spawn' | 'copy';
  hoverCell: { x: number; y: number } | null;
  copyDrag: {
    start: { x: number; y: number };
    now: { x: number; y: number };
  } | null;
  imgs: (HTMLImageElement | null)[];
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width * TILE_PX;
    canvas.height = height * TILE_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mode === 'copy' && copyDrag) {
      const ox = Math.min(copyDrag.start.x, copyDrag.now.x);
      const oy = Math.min(copyDrag.start.y, copyDrag.now.y);
      const w = Math.abs(copyDrag.now.x - copyDrag.start.x) + 1;
      const h = Math.abs(copyDrag.now.y - copyDrag.start.y) + 1;
      ctx.fillStyle = 'rgba(255, 204, 0, 0.18)';
      ctx.fillRect(ox * TILE_PX, oy * TILE_PX, w * TILE_PX, h * TILE_PX);
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        ox * TILE_PX + 1,
        oy * TILE_PX + 1,
        w * TILE_PX - 2,
        h * TILE_PX - 2,
      );
      return;
    }

    if (mode !== 'paint' || !brush || !hoverCell) return;
    ctx.globalAlpha = 0.55;
    const drawCell = (bt: BrushTile) => {
      const tx = hoverCell.x + bt.dx;
      const ty = hoverCell.y + bt.dy;
      if (tx < 0 || ty < 0 || tx >= width || ty >= height) return;
      const img = imgs[bt.s];
      if (!img) return;
      ctx.drawImage(
        img,
        bt.sx * TILE_PX,
        bt.sy * TILE_PX,
        TILE_PX,
        TILE_PX,
        tx * TILE_PX,
        ty * TILE_PX,
        TILE_PX,
        TILE_PX,
      );
    };
    for (const bt of brush.tiles) if (tileZ(bt.s) === 0) drawCell(bt);
    for (const bt of brush.tiles) if (tileZ(bt.s) === 1) drawCell(bt);
    ctx.globalAlpha = 1;
    // Outline the brush footprint so empty cells in the brush still show
    // where the stamp will land.
    ctx.strokeStyle = 'rgba(255, 204, 0, 0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      hoverCell.x * TILE_PX + 0.5,
      hoverCell.y * TILE_PX + 0.5,
      brush.w * TILE_PX - 1,
      brush.h * TILE_PX - 1,
    );
  }, [brush, mode, hoverCell, copyDrag, imgs, width, height]);
  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        imageRendering: 'pixelated',
        pointerEvents: 'none',
      }}
    />
  );
}

function BrushPreview({
  brush,
  imgs,
}: {
  brush: Brush;
  imgs: (HTMLImageElement | null)[];
}) {
  // Cap the preview size so a huge selection doesn't blow up the toolbar.
  const PREVIEW_TILE = Math.max(
    6,
    Math.min(16, Math.floor(64 / Math.max(brush.w, brush.h))),
  );
  const labelText =
    brush.source === 'sheet' && brush.sheetIdx != null
      ? `${SHEETS[brush.sheetIdx].id} (${brush.sx},${brush.sy})${
          brush.w > 1 || brush.h > 1 ? ` ${brush.w}×${brush.h}` : ''
        }`
      : `mapa ${brush.w}×${brush.h}`;
  return (
    <div
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: '0.55rem',
        color: 'rgba(225,215,255,0.7)',
      }}
    >
      Brocha:
      <BrushThumbnail brush={brush} imgs={imgs} tileSize={PREVIEW_TILE} />
      <span style={{ fontFamily: 'monospace' }}>{labelText}</span>
    </div>
  );
}

// Small composited canvas of any Brush. Works for both sheet and map
// brushes since both expose the same `tiles[]` representation.
function BrushThumbnail({
  brush,
  imgs,
  tileSize,
}: {
  brush: Brush;
  imgs: (HTMLImageElement | null)[];
  tileSize: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = brush.w * TILE_PX;
    canvas.height = brush.h * TILE_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw ground first, overlay second so transparent decoration tiles
    // composite correctly even inside the thumbnail.
    const drawCell = (bt: BrushTile) => {
      const img = imgs[bt.s];
      if (!img) return;
      ctx.drawImage(
        img,
        bt.sx * TILE_PX,
        bt.sy * TILE_PX,
        TILE_PX,
        TILE_PX,
        bt.dx * TILE_PX,
        bt.dy * TILE_PX,
        TILE_PX,
        TILE_PX,
      );
    };
    for (const bt of brush.tiles) if (tileZ(bt.s) === 0) drawCell(bt);
    for (const bt of brush.tiles) if (tileZ(bt.s) === 1) drawCell(bt);
  }, [brush, imgs]);
  return (
    <canvas
      ref={ref}
      style={{
        width: brush.w * tileSize,
        height: brush.h * tileSize,
        imageRendering: 'pixelated',
        border: '2px solid var(--color-accent)',
        background: '#0a0a14',
        display: 'block',
      }}
    />
  );
}

function IconButton({
  icon,
  hotkey,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: string;
  hotkey: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${label} (${hotkey})`}
      style={{
        position: 'relative',
        width: 38,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'var(--color-accent)' : '#1a1a1a',
        color: active
          ? '#0a0a14'
          : disabled
            ? 'rgba(225,215,255,0.3)'
            : '#e5e5e5',
        border: active ? '2px solid #ffcc00' : '2px solid var(--color-accent)',
        boxShadow: active ? '0 0 6px #ffcc00' : 'none',
        fontFamily: "'Silkscreen', cursive",
        fontSize: '1.05rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <span style={{ lineHeight: 1, paddingBottom: 4 }}>{icon}</span>
      <span
        style={{
          position: 'absolute',
          bottom: 2,
          right: 3,
          fontSize: '0.5rem',
          letterSpacing: '0.04em',
          color: active ? '#0a0a14' : 'rgba(225,215,255,0.6)',
        }}
      >
        {hotkey}
      </span>
    </button>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  onCommit?: () => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
      }}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit?.();
      }}
      style={{
        width: 70,
        padding: '4px 6px',
        background: '#0f1320',
        border: '2px solid var(--color-accent)',
        color: '#e5e5e5',
        fontFamily: "'Silkscreen', cursive",
        fontSize: '0.65rem',
        outline: 'none',
      }}
    />
  );
}

function LayerChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 9px',
        background: active ? 'var(--color-accent)' : '#1a1a1a',
        color: active ? '#0a0a14' : '#e5e5e5',
        border: active ? '2px solid #ffcc00' : '2px solid var(--color-accent)',
        boxShadow: active ? '0 0 6px #ffcc00' : 'none',
        fontFamily: "'Silkscreen', cursive",
        fontSize: '0.55rem',
        letterSpacing: '0.1em',
        cursor: 'pointer',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </button>
  );
}

function ToolbarLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '0.55rem',
        letterSpacing: '0.18em',
        color: 'rgba(225,215,255,0.6)',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

function Sep() {
  return (
    <div
      style={{
        width: 1,
        height: 22,
        background: 'rgba(75,45,142,0.5)',
        margin: '0 4px',
      }}
    />
  );
}
