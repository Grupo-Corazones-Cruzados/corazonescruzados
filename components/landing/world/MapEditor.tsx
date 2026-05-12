'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORIES,
  SHEETS,
  TILE_PX,
  tileZ,
  type ItemPlacement,
  type LayerData,
  type PropLight,
  type PropTrigger,
  type SceneMeta,
  type Tile,
  type Transition,
  type WorldMapData,
  type WorldProp,
} from './sheets';
import { ITEMS, ITEM_CATEGORIES, findItem, itemDataUrl } from './items';
import {
  LIGHT_MODE_OPTIONS,
  paintLightingFrame,
  type LightSource,
  type LightMode,
} from './lights';

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

// Bring an incoming map's `layers` array up to the multi-layer model
// the editor uses today. Always returns at least one layer so the
// editor never has to handle an empty list.
//
// - 0 layers → one empty "Capa 1".
// - 1 legacy layer with a mix of ground + overlay tiles → split into
//   "Suelo" and "Overlay" so existing maps keep their look without
//   forcing the user to manually re-organize.
// - Anything else → fill in missing id / name / visible defaults.
function migrateLayers(initial: LayerData[] | undefined): LayerData[] {
  const src = initial ?? [];
  if (src.length === 0) {
    return [{ id: 'layer-1', name: 'Capa 1', visible: true, tiles: [] }];
  }
  if (src.length === 1) {
    const sole = src[0];
    const ground = sole.tiles.filter((t) => tileZ(t.s) === 0);
    const overlay = sole.tiles.filter((t) => tileZ(t.s) === 1);
    if (ground.length > 0 && overlay.length > 0) {
      return [
        { id: 'suelo', name: 'Suelo', visible: true, tiles: ground },
        { id: 'overlay', name: 'Overlay', visible: true, tiles: overlay },
      ];
    }
    return [
      {
        id: sole.id ?? 'layer-1',
        name: sole.name ?? 'Capa 1',
        visible: sole.visible !== false,
        tiles: sole.tiles,
      },
    ];
  }
  return src.map((l, i) => ({
    id: l.id ?? `layer-${i + 1}`,
    name: l.name ?? `Capa ${i + 1}`,
    visible: l.visible !== false,
    tiles: l.tiles,
  }));
}

export default function MapEditor({
  initialMap,
  scene,
  scenes,
  embedded,
  onClose,
  onSaved,
  onSceneMetaChanged,
  sidebarTab,
}: {
  initialMap: WorldMapData;
  // The scene this editor is editing. Optional so the component can
  // still be mounted standalone for backwards-compatible callers.
  scene?: SceneMeta;
  // Sibling scenes — used to populate the "target scene" select in
  // transition popovers. Only kind='map' entries are valid targets.
  scenes?: SceneMeta[];
  // When true the outer container uses absolute (not fixed) positioning
  // so a parent can host it inside a flex layout (SceneManagerEditor).
  embedded?: boolean;
  onClose: () => void;
  onSaved: (map: WorldMapData) => void;
  // Called after a save that updated scene-level metadata (music, etc.)
  // so a parent shell can refresh its scene list.
  onSceneMetaChanged?: () => void;
  // Lateral tab state owned by SceneManagerEditor. When set to a value
  // other than 'assets', the asset/layers palette is hidden so the
  // canvas takes the full width.
  sidebarTab?: 'scenes' | 'assets';
}) {
  // Slug of the scene we're editing — drives the per-scene fetches
  // for npcs/lights and the scene query param on map PUT.
  const sceneSlug = scene?.slug ?? 'main';
  const [width, setWidth] = useState(initialMap.width);
  const [height, setHeight] = useState(initialMap.height);
  // Multi-layer model — each layer paints independently and the
  // canvas composites bottom → top. Legacy maps with a single layer
  // (or no layer metadata) get auto-split into Suelo / Overlay so
  // existing maps preserve their look.
  const [layers, setLayers] = useState<LayerData[]>(() =>
    migrateLayers(initialMap.layers),
  );
  const [activeLayerId, setActiveLayerId] = useState<string>(
    () => migrateLayers(initialMap.layers)[0]?.id ?? 'layer-1',
  );
  const [brush, setBrush] = useState<Brush | null>(null);
  // Mutually-exclusive editor modes. `paint` lays tiles (no collision
  // baked in); `collision` toggles the c flag on existing tiles;
  // `erase` removes the top-most thing; `spawn` sets the player spawn;
  // `copy` lets the user drag a rectangle on the canvas to capture the
  // already-painted region as a reusable brush; `light` places /
  // selects light sources for editing.
  type EditorMode =
    | 'paint'
    | 'collision'
    | 'erase'
    | 'spawn'
    | 'copy'
    | 'light'
    | 'transition'
    | 'prop';
  const [mode, setMode] = useState<EditorMode>('paint');
  const [brushHistory, setBrushHistory] = useState<Brush[]>([]);

  // Convenience: tiles of the active layer (used by paint / erase /
  // collision / copy). When the active layer somehow doesn't exist
  // we fall back to an empty list rather than crashing.
  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[0];
  const tiles = activeLayer?.tiles ?? [];
  const setTiles = (next: Tile[] | ((prev: Tile[]) => Tile[])) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== activeLayerId) return l;
        const newTiles = typeof next === 'function' ? next(l.tiles) : next;
        return { ...l, tiles: newTiles };
      }),
    );
  };

  // Lights live in the database (managed via /api/world/lights). The
  // editor keeps a local mirror so the map preview can animate without
  // refetching. CRUD calls update both server and local state.
  const [lights, setLights] = useState<LightSource[]>([]);
  const [editingLight, setEditingLight] = useState<LightSource | null>(null);
  const [ambientDarkness, setAmbientDarkness] = useState<number>(
    initialMap.ambientDarkness ?? 0,
  );
  // Transitions (doors) — saved alongside the map, drive scene
  // switches in the runtime. Painted with the new 'transition' editor
  // mode (Phase 2).
  const [transitions, setTransitions] = useState<Transition[]>(
    initialMap.transitions ?? [],
  );
  const [editingTransitionId, setEditingTransitionId] = useState<string | null>(
    null,
  );
  // Props (objetos del mundo) — non-collectible scenery. `propBrushItemId`
  // is the sprite the user will stamp on click; null = no sprite selected
  // (cursor still selects existing props). `editingPropId` opens the
  // configuration drawer for an existing prop.
  const [props, setProps] = useState<WorldProp[]>(initialMap.props ?? []);
  const [propBrushItemId, setPropBrushItemId] = useState<string | null>(null);
  const [editingPropId, setEditingPropId] = useState<string | null>(null);
  // Live in-editor preview of the lighting overlay so the admin can
  // see darkness + lights while building. Pure visualization toggle.
  const [lightingPreview, setLightingPreview] = useState(true);

  useEffect(() => {
    fetch(`/api/world/lights?scene=${encodeURIComponent(sceneSlug)}`)
      .then((r) => r.json())
      .then((j: { lights?: LightSource[] }) => {
        if (Array.isArray(j?.lights)) setLights(j.lights);
      })
      .catch(() => undefined);
  }, [sceneSlug]);
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
  const [activeTab, setActiveTab] = useState<
    'tiles' | 'items' | 'props' | 'layers'
  >('tiles');
  // Tracks the last cell affected by the current drag so that
  // collision-mode toggling doesn't flip the same cell back-and-forth
  // while the cursor sits on it.
  const lastDragCellRef = useRef<{ x: number; y: number } | null>(null);

  // ── Undo / redo history ────────────────────────────────────────
  type Snapshot = {
    layers: LayerData[];
    items: ItemPlacement[];
    props: WorldProp[];
    width: number;
    height: number;
    spawnX: number;
    spawnY: number;
  };
  const initSnap: Snapshot = useMemo(
    () => ({
      layers: migrateLayers(initialMap.layers),
      items: initialMap.items ?? [],
      props: initialMap.props ?? [],
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
    `${s.width}x${s.height}|${s.spawnX},${s.spawnY}|${JSON.stringify(s.layers)}|${JSON.stringify(s.items)}|${JSON.stringify(s.props)}`;

  const pushHistory = () => {
    if (restoringRef.current) return;
    const snap: Snapshot = {
      layers,
      items,
      props,
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
    setLayers(s.layers);
    setItems(s.items);
    setProps(s.props);
    setWidth(s.width);
    setHeight(s.height);
    setSpawnX(s.spawnX);
    setSpawnY(s.spawnY);
    // Make sure the active layer still exists after the restore.
    if (!s.layers.some((l) => l.id === activeLayerId) && s.layers[0]) {
      setActiveLayerId(s.layers[0].id ?? 'layer-1');
    }
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
        case 'l':
          e.preventDefault();
          setMode('light');
          return;
        case 't':
          e.preventDefault();
          setMode('transition');
          return;
        case 'p':
          e.preventDefault();
          setMode('prop');
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

    // Render every visible layer in array order (bottom → top). Within
    // each layer we still split into ground (z=0) then overlay (z=1)
    // so legacy maps with mixed-category tiles in a single layer keep
    // their stacking. Non-active layers dim slightly to keep focus on
    // the layer the user is actually painting.
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
    for (const layer of layers) {
      if (layer.visible === false) continue;
      const alpha = layer.id === activeLayerId ? 1 : 0.55;
      for (const t of layer.tiles) if (tileZ(t.s) === 0) drawTile(t, alpha);
      for (const t of layer.tiles) if (tileZ(t.s) === 1) drawTile(t, alpha);
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

    // Props — drawn full-tile (no halo) so they read as scenery. Each
    // prop gets a thin colored corner badge that hints at its config:
    // amber for solid, sky for light, magenta for trigger. The prop
    // currently being edited gets a bright yellow outline.
    for (const p of props) {
      const def = findItem(p.itemId);
      if (!def) continue;
      const img = itemImgs.get(def.id);
      if (img && img.complete) {
        ctx.drawImage(
          img,
          p.x * TILE_PX,
          p.y * TILE_PX,
          TILE_PX,
          TILE_PX,
        );
      }
      const badges: string[] = [];
      if (p.solid) badges.push('#ffb84d');
      if (p.light) badges.push('#7ec8ff');
      if (p.trigger) badges.push('#ff80f0');
      badges.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(p.x * TILE_PX + 2 + i * 6, p.y * TILE_PX + 2, 4, 4);
      });
      if (editingPropId === p.id) {
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          p.x * TILE_PX + 1,
          p.y * TILE_PX + 1,
          TILE_PX - 2,
          TILE_PX - 2,
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

    // Light markers — small dot in the light's colour at each light's
    // tile, plus a faint radius ring when that light is selected. Kept
    // visible even when the live lighting preview is off so the admin
    // can find the lights they've placed.
    for (const l of lights) {
      const lcx = l.x * TILE_PX + TILE_PX / 2;
      const lcy = l.y * TILE_PX + TILE_PX / 2;
      const isSelected = editingLight?.id === l.id;
      if (isSelected) {
        ctx.strokeStyle = `${l.color}88`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(lcx, lcy, l.radius * TILE_PX, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#0a0a14';
      ctx.beginPath();
      ctx.arc(lcx, lcy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.arc(lcx, lcy, 5, 0, Math.PI * 2);
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lcx, lcy, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Transition rectangles — translucent magenta with the target slug
    // labelled inside. Highlighted when selected for editing.
    for (const t of transitions) {
      const isSel = editingTransitionId === t.id;
      ctx.fillStyle = isSel
        ? 'rgba(255, 128, 240, 0.45)'
        : 'rgba(255, 128, 240, 0.25)';
      ctx.fillRect(
        t.x * TILE_PX,
        t.y * TILE_PX,
        t.w * TILE_PX,
        t.h * TILE_PX,
      );
      ctx.strokeStyle = isSel ? '#ffcc00' : '#ff80f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        t.x * TILE_PX + 1,
        t.y * TILE_PX + 1,
        t.w * TILE_PX - 2,
        t.h * TILE_PX - 2,
      );
      ctx.fillStyle = '#0a0a14';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelX = (t.x + t.w / 2) * TILE_PX;
      const labelY = (t.y + t.h / 2) * TILE_PX;
      const label = `→ ${t.targetScene || '(?)'}`;
      const metrics = ctx.measureText(label);
      ctx.fillStyle = 'rgba(10, 10, 20, 0.75)';
      ctx.fillRect(
        labelX - metrics.width / 2 - 3,
        labelY - 6,
        metrics.width + 6,
        12,
      );
      ctx.fillStyle = '#ff80f0';
      ctx.fillText(label, labelX, labelY + 1);
    }
  }, [
    layers,
    activeLayerId,
    items,
    imgs,
    width,
    height,
    showCollisions,
    spawnX,
    spawnY,
    itemImgs,
    lights,
    editingLight,
    transitions,
    editingTransitionId,
    props,
    editingPropId,
  ]);

  // ── Live lighting preview ────────────────────────────────────────
  // Pinned over the editor canvas as a separate overlay so it can
  // animate with RAF without re-running the heavy tile render.
  const lightingPreviewRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = lightingPreviewRef.current;
    if (!canvas) return;
    canvas.width = width * TILE_PX;
    canvas.height = height * TILE_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!lightingPreview) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      paintLightingFrame(
        ctx,
        canvas.width,
        canvas.height,
        TILE_PX,
        ambientDarkness,
        lights,
        now,
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [width, height, ambientDarkness, lights, lightingPreview]);

  // ── Layers CRUD ────────────────────────────────────────────────
  const newLayerId = () =>
    `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const addLayer = () => {
    const id = newLayerId();
    setLayers((prev) => {
      const next = [
        ...prev,
        {
          id,
          name: `Capa ${prev.length + 1}`,
          visible: true,
          tiles: [] as Tile[],
        },
      ];
      return next;
    });
    setActiveLayerId(id);
    window.setTimeout(pushHistory, 0);
  };
  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    const filtered = layers.filter((l) => l.id !== id);
    setLayers(filtered);
    if (activeLayerId === id) {
      setActiveLayerId(filtered[0]?.id ?? 'layer-1');
    }
    window.setTimeout(pushHistory, 0);
  };
  const renameLayer = (id: string, name: string) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
  };
  const toggleLayerVisible = (id: string) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, visible: l.visible === false } : l,
      ),
    );
  };
  const moveLayer = (id: string, dir: -1 | 1) => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      const newIdx = idx + dir;
      if (idx < 0 || newIdx < 0 || newIdx >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(newIdx, 0, moved);
      return next;
    });
    window.setTimeout(pushHistory, 0);
  };

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

  // ── Lights CRUD ────────────────────────────────────────────────
  const createLight = async (x: number, y: number) => {
    const r = await fetch('/api/world/lights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene: sceneSlug,
        x,
        y,
        radius: 4,
        color: '#ffd27a',
        mode: 'steady',
        periodMs: 1000,
        intensity: 1,
      }),
    });
    const j = await r.json();
    if (j?.light) {
      setLights((prev) => [...prev, j.light as LightSource]);
      setEditingLight(j.light as LightSource);
    }
  };
  const updateLight = async (light: LightSource) => {
    setLights((prev) => prev.map((l) => (l.id === light.id ? light : l)));
    setEditingLight((cur) => (cur && cur.id === light.id ? light : cur));
    await fetch(`/api/world/lights/${light.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x: light.x,
        y: light.y,
        radius: light.radius,
        color: light.color,
        mode: light.mode,
        periodMs: light.periodMs,
        intensity: light.intensity,
      }),
    }).catch(() => undefined);
  };
  const deleteLight = async (id: number) => {
    setLights((prev) => prev.filter((l) => l.id !== id));
    setEditingLight(null);
    await fetch(`/api/world/lights/${id}`, { method: 'DELETE' }).catch(
      () => undefined,
    );
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
    if (mode === 'light') {
      // Click on an existing light selects it for editing, click on
      // empty space creates a new light at the cursor.
      const existing = lights.find((l) => l.x === cx && l.y === cy);
      if (existing) {
        setEditingLight(existing);
      } else {
        void createLight(cx, cy);
      }
      return;
    }
    if (mode === 'prop') {
      // Click on an existing prop opens its config drawer. Click on an
      // empty cell with a sprite brush selected creates a new prop with
      // sensible defaults (not solid, no light, no trigger).
      const existing = props.find((p) => p.x === cx && p.y === cy);
      if (existing) {
        setEditingPropId(existing.id);
        return;
      }
      if (!propBrushItemId) return;
      const id = `prop-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      setProps((prev) => [
        ...prev,
        { id, x: cx, y: cy, itemId: propBrushItemId },
      ]);
      window.setTimeout(pushHistory, 0);
      return;
    }
    if (mode === 'transition') {
      // Click on an existing transition rect selects it; otherwise
      // create a new 1×1 transition at the cursor and open the
      // editor popover.
      const hit = transitions.find(
        (t) =>
          cx >= t.x && cx < t.x + t.w && cy >= t.y && cy < t.y + t.h,
      );
      if (hit) {
        setEditingTransitionId(hit.id);
        return;
      }
      const targetSlug =
        scenes?.find((s) => s.kind === 'map' && s.slug !== sceneSlug)?.slug ??
        '';
      const newId = `tr-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const next: Transition = {
        id: newId,
        x: cx,
        y: cy,
        w: 1,
        h: 1,
        targetScene: targetSlug,
        fadeMs: 250,
      };
      setTransitions((prev) => [...prev, next]);
      setEditingTransitionId(newId);
      window.setTimeout(pushHistory, 0);
      return;
    }
    if (mode === 'erase') {
      // Erase removes the top-most tile from the ACTIVE layer at the
      // cursor cell. Props and items live outside the layer system so
      // they get peeled first if there's nothing in the active layer
      // to remove. Props before items (props are usually placed last).
      const propIdx = props.findIndex((p) => p.x === cx && p.y === cy);
      const itemIdx = items.findIndex((it) => it.x === cx && it.y === cy);
      const hasActiveTileHere = tiles.some(
        (t) => t.x === cx && t.y === cy,
      );
      if (propIdx >= 0 && !hasActiveTileHere) {
        setProps((prev) => prev.filter((_, i) => i !== propIdx));
        return;
      }
      if (itemIdx >= 0 && !hasActiveTileHere) {
        setItems((prev) => prev.filter((_, i) => i !== itemIdx));
        return;
      }
      setTiles((prev) => {
        let target = -1;
        let bestZ = -1;
        prev.forEach((t, i) => {
          if (t.x !== cx || t.y !== cy) return;
          const z = tileZ(t.s);
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
      // Toggle the c flag on the top-most tile of the ACTIVE layer at
      // (cx, cy). During a drag, skip cells we just toggled so the
      // same cell doesn't flip on every mousemove tick.
      const last = lastDragCellRef.current;
      if (last && last.x === cx && last.y === cy) return;
      lastDragCellRef.current = { x: cx, y: cy };
      setTiles((prev) => {
        let target = -1;
        let bestZ = -1;
        prev.forEach((t, i) => {
          if (t.x !== cx || t.y !== cy) return;
          const z = tileZ(t.s);
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
      const r = await fetch('/api/world/map', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: sceneSlug,
          width,
          height,
          layers,
          items,
          spawnX,
          spawnY,
          ambientDarkness,
          transitions,
          props,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j?.error ?? 'No se pudo guardar');
        return;
      }
      setSavedAt(Date.now());
      onSaved({
        name: sceneSlug,
        width,
        height,
        layers,
        items,
        spawnX,
        spawnY,
        ambientDarkness,
        transitions,
        props,
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

  // When SceneManagerEditor's lateral tab is anywhere other than
  // 'assets', the aside collapses entirely and the canvas takes the
  // full editor width. Default to showing the aside for callers that
  // don't pass `sidebarTab` (standalone mounts of MapEditor).
  const asideVisible = sidebarTab === undefined || sidebarTab === 'assets';

  return (
    <div
      style={{
        position: embedded ? 'absolute' : 'fixed',
        inset: 0,
        zIndex: embedded ? undefined : 200000,
        background: '#0a0a14',
        color: '#e5e5e5',
        fontFamily: "'Silkscreen', cursive",
        display: 'grid',
        gridTemplateColumns: asideVisible ? '300px 1fr' : '1fr',
        animation: embedded ? undefined : 'pixelFadeIn 0.4s ease-out',
      }}
    >
      <aside
        style={{
          background: '#131923',
          borderRight: '2px solid var(--color-accent)',
          display: asideVisible ? 'flex' : 'none',
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
          {(['tiles', 'items', 'props', 'layers'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setActiveTab(t);
                if (t === 'tiles') {
                  setItemBrush(null);
                  setPropBrushItemId(null);
                } else if (t === 'items') {
                  setBrush(null);
                  setPropBrushItemId(null);
                } else if (t === 'props') {
                  setBrush(null);
                  setItemBrush(null);
                  setMode('prop');
                } else {
                  setBrush(null);
                  setItemBrush(null);
                  setPropBrushItemId(null);
                }
              }}
              style={{
                flex: 1,
                padding: '6px 8px',
                background:
                  activeTab === t ? 'var(--color-accent)' : '#1a1a1a',
                color: activeTab === t ? '#0a0a14' : '#e5e5e5',
                border: '2px solid var(--color-accent)',
                fontFamily: "'Silkscreen', cursive",
                fontSize: '0.55rem',
                letterSpacing: '0.1em',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {t === 'tiles'
                ? 'Tiles'
                : t === 'items'
                  ? 'Items'
                  : t === 'props'
                    ? 'Props'
                    : 'Capas'}
            </button>
          ))}
        </div>

        {activeTab === 'tiles' && (
          <div
            style={{
              padding: 10,
              borderBottom: '2px solid rgba(75,45,142,0.4)',
            }}
          >
            <select
              value={activeCategory}
              onChange={(e) =>
                setActiveCategory(
                  e.target.value as (typeof CATEGORIES)[number]['id'],
                )
              }
              style={{
                width: '100%',
                padding: '6px 8px',
                background: '#0f1320',
                color: '#e5e5e5',
                border: '2px solid var(--color-accent)',
                fontFamily: "'Silkscreen', cursive",
                fontSize: '0.6rem',
                letterSpacing: '0.08em',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'layers' && (
          <LayersPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onActivate={setActiveLayerId}
            onAdd={addLayer}
            onDelete={deleteLayer}
            onRename={renameLayer}
            onToggleVisible={toggleLayerVisible}
            onMove={moveLayer}
          />
        )}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 12,
            display: activeTab === 'layers' ? 'none' : 'flex',
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
          {activeTab === 'props' && (
            <>
              <div
                style={{
                  fontSize: '0.55rem',
                  letterSpacing: '0.12em',
                  color: 'rgba(225,215,255,0.7)',
                  lineHeight: 1.5,
                  marginBottom: 4,
                }}
              >
                Elige un sprite y haz clic en el mapa para colocar un
                prop. Clic sobre un prop existente para configurarlo
                (sólido, luz, trigger).
              </div>
              {ITEM_CATEGORIES.map((cat) => {
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
                        const active = propBrushItemId === it.id;
                        return (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => {
                              setPropBrushItemId(it.id);
                              setMode('prop');
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
            </>
          )}
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
          <IconButton
            icon="☼"
            hotkey="L"
            label="Luces (clic para crear / editar)"
            active={mode === 'light'}
            onClick={() => setMode('light')}
          />
          <IconButton
            icon="↦"
            hotkey="T"
            label="Transiciones (puertas a otra escena)"
            active={mode === 'transition'}
            onClick={() => setMode('transition')}
          />
          <IconButton
            icon="◆"
            hotkey="P"
            label="Props (objetos del mundo — lámparas, decoración, triggers)"
            active={mode === 'prop'}
            onClick={() => setMode('prop')}
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

          {/* Ambient darkness + lighting preview toggle. The slider
              feeds the same `paintLightingFrame` used in gameplay so
              what the admin sees in the preview is what players see. */}
          <ToolbarLabel>Oscuridad</ToolbarLabel>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={ambientDarkness}
            onChange={(e) => setAmbientDarkness(Number(e.target.value))}
            style={{ width: 110, accentColor: '#7B5FBF' }}
          />
          <span
            style={{
              fontSize: '0.55rem',
              color: 'rgba(225,215,255,0.6)',
              fontFamily: 'monospace',
              minWidth: 32,
            }}
          >
            {Math.round(ambientDarkness * 100)}%
          </span>
          <IconButton
            icon={lightingPreview ? '☀' : '☾'}
            hotkey=""
            label="Mostrar / ocultar preview de luces"
            active={lightingPreview}
            onClick={() => setLightingPreview((v) => !v)}
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
                if (mode === 'light' || mode === 'transition') {
                  // Click-only modes (no drag painting).
                  paintAt(e.clientX, e.clientY);
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
                      : mode === 'copy' ||
                          mode === 'collision' ||
                          mode === 'light' ||
                          mode === 'transition'
                        ? 'crosshair'
                        : brush
                          ? 'crosshair'
                          : 'default',
                boxShadow: '6px 6px 0 rgba(0,0,0,0.5)',
                display: 'block',
              }}
            />
            {/* Live lighting preview — sits above the map but below the
                brush hover preview so the admin can still see where their
                stamp will land in dark areas. */}
            <canvas
              ref={lightingPreviewRef}
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

      {editingLight && (
        <LightEditModal
          light={editingLight}
          onChange={(l) => updateLight(l)}
          onClose={() => setEditingLight(null)}
          onDelete={() => deleteLight(editingLight.id)}
        />
      )}

      {editingTransitionId && (() => {
        const tr = transitions.find((t) => t.id === editingTransitionId);
        if (!tr) return null;
        return (
          <TransitionEditModal
            transition={tr}
            mapWidth={width}
            mapHeight={height}
            currentScene={sceneSlug}
            scenes={scenes ?? []}
            onChange={(next) =>
              setTransitions((prev) =>
                prev.map((t) => (t.id === next.id ? next : t)),
              )
            }
            onClose={() => {
              setEditingTransitionId(null);
              window.setTimeout(pushHistory, 0);
            }}
            onDelete={() => {
              setTransitions((prev) =>
                prev.filter((t) => t.id !== editingTransitionId),
              );
              setEditingTransitionId(null);
              window.setTimeout(pushHistory, 0);
            }}
          />
        );
      })()}

      {editingPropId && (() => {
        const p = props.find((x) => x.id === editingPropId);
        if (!p) return null;
        return (
          <PropEditModal
            prop={p}
            layers={layers}
            scenes={scenes ?? []}
            onChange={(next) =>
              setProps((prev) => prev.map((x) => (x.id === next.id ? next : x)))
            }
            onClose={() => {
              setEditingPropId(null);
              window.setTimeout(pushHistory, 0);
            }}
            onDelete={() => {
              setProps((prev) => prev.filter((x) => x.id !== editingPropId));
              setEditingPropId(null);
              window.setTimeout(pushHistory, 0);
            }}
          />
        );
      })()}
    </div>
  );
}

function TransitionEditModal({
  transition,
  mapWidth,
  mapHeight,
  currentScene,
  scenes,
  onChange,
  onClose,
  onDelete,
}: {
  transition: Transition;
  mapWidth: number;
  mapHeight: number;
  currentScene: string;
  scenes: SceneMeta[];
  onChange: (t: Transition) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const targets = scenes.filter(
    (s) => s.kind === 'map' && s.slug !== currentScene,
  );
  const [draft, setDraft] = useState<Transition>(transition);
  useEffect(() => {
    setDraft(transition);
  }, [transition]);
  const update = (patch: Partial<Transition>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(next);
  };
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,20,0.55)',
        zIndex: 200500,
        display: 'grid',
        placeItems: 'center',
        fontFamily: "'Silkscreen', cursive",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#131923',
          border: '2px solid var(--color-accent)',
          padding: 18,
          width: 360,
          color: '#e5e5e5',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: '0.85rem',
            letterSpacing: '0.18em',
            color: 'var(--color-accent)',
            textTransform: 'uppercase',
          }}
        >
          Transición ↦
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          <Field label={`X (0..${mapWidth - 1})`}>
            <input
              type="number"
              value={draft.x}
              min={0}
              max={mapWidth - 1}
              onChange={(e) =>
                update({
                  x: Math.max(
                    0,
                    Math.min(mapWidth - 1, Math.floor(Number(e.target.value))),
                  ),
                })
              }
              style={inputStyle}
            />
          </Field>
          <Field label={`Y (0..${mapHeight - 1})`}>
            <input
              type="number"
              value={draft.y}
              min={0}
              max={mapHeight - 1}
              onChange={(e) =>
                update({
                  y: Math.max(
                    0,
                    Math.min(mapHeight - 1, Math.floor(Number(e.target.value))),
                  ),
                })
              }
              style={inputStyle}
            />
          </Field>
          <Field label="Ancho (tiles)">
            <input
              type="number"
              value={draft.w}
              min={1}
              max={mapWidth}
              onChange={(e) =>
                update({ w: Math.max(1, Math.floor(Number(e.target.value))) })
              }
              style={inputStyle}
            />
          </Field>
          <Field label="Alto (tiles)">
            <input
              type="number"
              value={draft.h}
              min={1}
              max={mapHeight}
              onChange={(e) =>
                update({ h: Math.max(1, Math.floor(Number(e.target.value))) })
              }
              style={inputStyle}
            />
          </Field>
        </div>
        <Field label="Escena destino">
          <select
            value={draft.targetScene}
            onChange={(e) => update({ targetScene: e.target.value })}
            style={inputStyle}
          >
            <option value="">— elegir —</option>
            {targets.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name} ({s.slug})
              </option>
            ))}
          </select>
        </Field>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          <Field label="Spawn X destino (vacío = default)">
            <input
              type="number"
              value={draft.targetSpawnX ?? ''}
              onChange={(e) =>
                update({
                  targetSpawnX:
                    e.target.value === ''
                      ? undefined
                      : Math.max(0, Math.floor(Number(e.target.value))),
                })
              }
              style={inputStyle}
            />
          </Field>
          <Field label="Spawn Y destino (vacío = default)">
            <input
              type="number"
              value={draft.targetSpawnY ?? ''}
              onChange={(e) =>
                update({
                  targetSpawnY:
                    e.target.value === ''
                      ? undefined
                      : Math.max(0, Math.floor(Number(e.target.value))),
                })
              }
              style={inputStyle}
            />
          </Field>
        </div>
        <Field label={`Fade (ms): ${draft.fadeMs ?? 250}`}>
          <input
            type="range"
            min={0}
            max={1500}
            step={50}
            value={draft.fadeMs ?? 250}
            onChange={(e) => update({ fadeMs: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#7B5FBF' }}
          />
        </Field>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            type="button"
            onClick={onDelete}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: '#3a1a1a',
              color: '#ff8080',
              border: '2px solid #6f2a2a',
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              cursor: 'pointer',
            }}
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: '#1a1a1a',
              color: '#e5e5e5',
              border: '2px solid var(--color-accent)',
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function PropEditModal({
  prop,
  layers,
  scenes,
  onChange,
  onClose,
  onDelete,
}: {
  prop: WorldProp;
  layers: LayerData[];
  scenes: SceneMeta[];
  onChange: (p: WorldProp) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<WorldProp>(prop);
  useEffect(() => {
    setDraft(prop);
  }, [prop]);
  const update = (patch: Partial<WorldProp>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(next);
  };

  const def = findItem(draft.itemId);
  const cinematicScenes = scenes.filter((s) => s.kind === 'cinematic');

  const defaultLight = (): PropLight => ({
    radius: 4,
    color: '#ffcc66',
    mode: 'flicker',
    periodMs: 1000,
    intensity: 0.85,
  });
  const defaultTrigger = (): PropTrigger => ({
    kind: 'cinematic',
    activation: 'interact',
    cinematicSlug: cinematicScenes[0]?.slug ?? '',
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,20,0.55)',
        zIndex: 200500,
        display: 'grid',
        placeItems: 'center',
        fontFamily: "'Silkscreen', cursive",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#131923',
          border: '2px solid var(--color-accent)',
          padding: 18,
          width: 420,
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#e5e5e5',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {def && (
            <img
              src={itemDataUrl(def)}
              alt=""
              style={{
                width: 40,
                height: 40,
                imageRendering: 'pixelated',
                background: '#0a0a14',
                border: '2px solid rgba(75,45,142,0.5)',
                padding: 3,
              }}
            />
          )}
          <div>
            <div
              style={{
                fontSize: '0.85rem',
                letterSpacing: '0.18em',
                color: 'var(--color-accent)',
                textTransform: 'uppercase',
              }}
            >
              Prop ◆
            </div>
            <div
              style={{
                fontSize: '0.6rem',
                color: 'rgba(225,215,255,0.6)',
                letterSpacing: '0.1em',
              }}
            >
              {def?.label ?? draft.itemId} · ({draft.x}, {draft.y})
            </div>
          </div>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            background: '#0a0a14',
            border: '2px solid rgba(75,45,142,0.4)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={!!draft.solid}
            onChange={(e) => update({ solid: e.target.checked })}
          />
          <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em' }}>
            Sólido (bloquea al jugador)
          </span>
        </label>

        {/* Light */}
        <div
          style={{
            border: '2px solid rgba(75,45,142,0.4)',
            padding: 10,
            background: '#0a0a14',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={!!draft.light}
              onChange={(e) =>
                update({ light: e.target.checked ? defaultLight() : null })
              }
            />
            <span style={{ fontSize: '0.7rem', letterSpacing: '0.12em' }}>
              Emite luz
            </span>
          </label>
          {draft.light && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              <Field label={`Radio: ${draft.light.radius} tiles`}>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={0.5}
                  value={draft.light.radius}
                  onChange={(e) =>
                    update({
                      light: { ...draft.light!, radius: Number(e.target.value) },
                    })
                  }
                  style={{ width: '100%', accentColor: '#7B5FBF' }}
                />
              </Field>
              <Field label="Color">
                <input
                  type="color"
                  value={draft.light.color}
                  onChange={(e) =>
                    update({
                      light: { ...draft.light!, color: e.target.value },
                    })
                  }
                  style={{ width: '100%', height: 24, border: 'none' }}
                />
              </Field>
              <Field label="Modo">
                <select
                  value={draft.light.mode}
                  onChange={(e) =>
                    update({
                      light: {
                        ...draft.light!,
                        mode: e.target.value as PropLight['mode'],
                      },
                    })
                  }
                  style={inputStyle}
                >
                  {LIGHT_MODE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Intensidad: ${draft.light.intensity.toFixed(2)}`}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={draft.light.intensity}
                  onChange={(e) =>
                    update({
                      light: {
                        ...draft.light!,
                        intensity: Number(e.target.value),
                      },
                    })
                  }
                  style={{ width: '100%', accentColor: '#7B5FBF' }}
                />
              </Field>
              <Field label={`Periodo: ${draft.light.periodMs} ms`}>
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={50}
                  value={draft.light.periodMs}
                  onChange={(e) =>
                    update({
                      light: {
                        ...draft.light!,
                        periodMs: Number(e.target.value),
                      },
                    })
                  }
                  style={{ width: '100%', accentColor: '#7B5FBF' }}
                />
              </Field>
            </div>
          )}
        </div>

        {/* Trigger */}
        <div
          style={{
            border: '2px solid rgba(75,45,142,0.4)',
            padding: 10,
            background: '#0a0a14',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={!!draft.trigger}
              onChange={(e) =>
                update({ trigger: e.target.checked ? defaultTrigger() : null })
              }
            />
            <span style={{ fontSize: '0.7rem', letterSpacing: '0.12em' }}>
              Trigger (cambio en el mapa)
            </span>
          </label>
          {draft.trigger && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                }}
              >
                <Field label="Se activa">
                  <select
                    value={draft.trigger.activation}
                    onChange={(e) =>
                      update({
                        trigger: {
                          ...draft.trigger!,
                          activation: e.target.value as
                            | 'interact'
                            | 'step',
                        },
                      })
                    }
                    style={inputStyle}
                  >
                    <option value="interact">Al presionar E</option>
                    <option value="step">Al pisar el tile</option>
                  </select>
                </Field>
                <Field label="Tipo de efecto">
                  <select
                    value={draft.trigger.kind}
                    onChange={(e) => {
                      const kind = e.target.value as PropTrigger['kind'];
                      const activation = draft.trigger!.activation;
                      if (kind === 'cinematic') {
                        update({
                          trigger: {
                            kind,
                            activation,
                            cinematicSlug: cinematicScenes[0]?.slug ?? '',
                          },
                        });
                      } else if (kind === 'tile-change') {
                        update({
                          trigger: {
                            kind,
                            activation,
                            layerId: layers[0]?.id ?? '',
                            tileX: draft.x,
                            tileY: draft.y,
                            newTile: null,
                          },
                        });
                      } else {
                        update({
                          trigger: {
                            kind,
                            activation,
                            layerId: layers[0]?.id ?? '',
                          },
                        });
                      }
                    }}
                    style={inputStyle}
                  >
                    <option value="cinematic">Reproducir cinemática</option>
                    <option value="tile-change">Cambiar un tile</option>
                    <option value="layer-toggle">
                      Mostrar / ocultar capa
                    </option>
                  </select>
                </Field>
              </div>
              {draft.trigger.kind === 'cinematic' && (
                <Field label="Cinemática a reproducir">
                  <select
                    value={draft.trigger.cinematicSlug}
                    onChange={(e) =>
                      update({
                        trigger: {
                          ...draft.trigger!,
                          kind: 'cinematic',
                          cinematicSlug: e.target.value,
                        },
                      })
                    }
                    style={inputStyle}
                  >
                    <option value="">— elegir —</option>
                    {cinematicScenes.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name} ({s.slug})
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {draft.trigger.kind === 'tile-change' && (
                <>
                  <Field label="Capa a modificar">
                    <select
                      value={draft.trigger.layerId}
                      onChange={(e) =>
                        update({
                          trigger: {
                            ...draft.trigger!,
                            kind: 'tile-change',
                            layerId: e.target.value,
                          },
                        })
                      }
                      style={inputStyle}
                    >
                      {layers.map((l) => (
                        <option key={l.id ?? ''} value={l.id ?? ''}>
                          {l.name ?? l.id ?? '(sin nombre)'}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    }}
                  >
                    <Field label="Tile X destino">
                      <input
                        type="number"
                        value={draft.trigger.tileX}
                        onChange={(e) =>
                          update({
                            trigger: {
                              ...draft.trigger!,
                              kind: 'tile-change',
                              tileX: Math.max(
                                0,
                                Math.floor(Number(e.target.value) || 0),
                              ),
                            },
                          })
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Tile Y destino">
                      <input
                        type="number"
                        value={draft.trigger.tileY}
                        onChange={(e) =>
                          update({
                            trigger: {
                              ...draft.trigger!,
                              kind: 'tile-change',
                              tileY: Math.max(
                                0,
                                Math.floor(Number(e.target.value) || 0),
                              ),
                            },
                          })
                        }
                        style={inputStyle}
                      />
                    </Field>
                  </div>
                  <div
                    style={{
                      fontSize: '0.55rem',
                      color: 'rgba(225,215,255,0.55)',
                      letterSpacing: '0.1em',
                      lineHeight: 1.5,
                    }}
                  >
                    Cambio: BORRAR el tile destino. (En v1 sólo se
                    soporta borrar; para pintar un sprite distinto, usa
                    una capa visible/oculta con el trigger
                    &ldquo;mostrar / ocultar capa&rdquo;.)
                  </div>
                </>
              )}
              {draft.trigger.kind === 'layer-toggle' && (
                <Field label="Capa a togglear">
                  <select
                    value={draft.trigger.layerId}
                    onChange={(e) =>
                      update({
                        trigger: {
                          ...draft.trigger!,
                          kind: 'layer-toggle',
                          layerId: e.target.value,
                        },
                      })
                    }
                    style={inputStyle}
                  >
                    {layers.map((l) => (
                      <option key={l.id ?? ''} value={l.id ?? ''}>
                        {l.name ?? l.id ?? '(sin nombre)'}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.6rem',
                  letterSpacing: '0.1em',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!draft.trigger.repeat}
                  onChange={(e) =>
                    update({
                      trigger: {
                        ...draft.trigger!,
                        repeat: e.target.checked,
                      },
                    })
                  }
                />
                Se puede activar más de una vez por sesión
              </label>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            type="button"
            onClick={onDelete}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: '#3a1a1a',
              color: '#ff8080',
              border: '2px solid #6f2a2a',
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              cursor: 'pointer',
            }}
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: '#1a1a1a',
              color: '#e5e5e5',
              border: '2px solid var(--color-accent)',
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span
        style={{
          fontSize: '0.5rem',
          color: 'rgba(225,215,255,0.65)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#0a0a14',
  color: '#e5e5e5',
  border: '2px solid rgba(75,45,142,0.6)',
  fontFamily: "'Silkscreen', cursive",
  fontSize: '0.6rem',
  padding: '4px 6px',
  outline: 'none',
};

function LightEditModal({
  light,
  onChange,
  onClose,
  onDelete,
}: {
  light: LightSource;
  onChange: (l: LightSource) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  // Local edit state with debounced server commits — typing in the
  // sliders shouldn't fire 60 PUTs/s.
  const [draft, setDraft] = useState<LightSource>(light);
  // Reset whenever the parent picks a different light.
  useEffect(() => {
    setDraft(light);
  }, [light]);
  const commitTimer = useRef<number | null>(null);
  const update = (patch: Partial<LightSource>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (commitTimer.current) window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      onChange(next);
      commitTimer.current = null;
    }, 200);
  };
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200001,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 92vw)',
          background: '#0f1320',
          border: '2px solid var(--color-accent)',
          padding: 20,
          fontFamily: "'Silkscreen', cursive",
          color: '#e5e5e5',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '6px 6px 0 rgba(0,0,0,0.6)',
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
          Luz #{light.id} · ({light.x},{light.y})
        </div>

        <ModalField label="Color">
          <input
            type="color"
            value={draft.color}
            onChange={(e) => update({ color: e.target.value })}
            style={{
              width: 60,
              height: 32,
              padding: 0,
              border: '2px solid var(--color-accent)',
              background: '#0a0a14',
              cursor: 'pointer',
            }}
          />
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              color: 'rgba(225,215,255,0.7)',
              marginLeft: 8,
            }}
          >
            {draft.color}
          </span>
        </ModalField>

        <ModalField label={`Radio · ${draft.radius.toFixed(1)} tiles`}>
          <input
            type="range"
            min={0.5}
            max={20}
            step={0.5}
            value={draft.radius}
            onChange={(e) => update({ radius: Number(e.target.value) })}
            style={{ flex: 1, accentColor: '#7B5FBF' }}
          />
        </ModalField>

        <ModalField label={`Intensidad · ${Math.round(draft.intensity * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={draft.intensity}
            onChange={(e) => update({ intensity: Number(e.target.value) })}
            style={{ flex: 1, accentColor: '#7B5FBF' }}
          />
        </ModalField>

        <ModalField label="Modo">
          <select
            value={draft.mode}
            onChange={(e) => update({ mode: e.target.value as LightMode })}
            style={{
              padding: '6px 8px',
              background: '#0a0a14',
              border: '2px solid var(--color-accent)',
              color: '#e5e5e5',
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.65rem',
            }}
          >
            {LIGHT_MODE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </ModalField>

        {draft.mode !== 'steady' && (
          <ModalField label={`Periodo · ${draft.periodMs} ms`}>
            <input
              type="range"
              min={100}
              max={5000}
              step={50}
              value={draft.periodMs}
              onChange={(e) => update({ periodMs: Number(e.target.value) })}
              style={{ flex: 1, accentColor: '#7B5FBF' }}
            />
          </ModalField>
        )}

        <ModalField label="Posición (tile)">
          <input
            type="number"
            value={draft.x}
            onChange={(e) =>
              update({ x: Math.floor(Number(e.target.value) || 0) })
            }
            style={modalNumStyle}
          />
          <input
            type="number"
            value={draft.y}
            onChange={(e) =>
              update({ y: Math.floor(Number(e.target.value) || 0) })
            }
            style={modalNumStyle}
          />
        </ModalField>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn pixel-btn-primary"
            style={{ flex: 1, padding: '8px 12px', fontSize: '0.62rem' }}
          >
            Listo
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="pixel-btn pixel-btn-secondary"
            style={{
              padding: '8px 12px',
              fontSize: '0.62rem',
              background: '#3a1a1a',
              color: '#ff8080',
            }}
          >
            Borrar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontSize: '0.55rem',
          letterSpacing: '0.16em',
          color: 'rgba(225,215,255,0.6)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

const modalNumStyle: React.CSSProperties = {
  width: 70,
  padding: '6px 8px',
  background: '#0a0a14',
  border: '2px solid var(--color-accent)',
  color: '#e5e5e5',
  fontFamily: "'Silkscreen', cursive",
  fontSize: '0.65rem',
  outline: 'none',
};

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
  mode:
    | 'paint'
    | 'collision'
    | 'erase'
    | 'spawn'
    | 'copy'
    | 'light'
    | 'transition'
    | 'prop';
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

function LayersPanel({
  layers,
  activeLayerId,
  onActivate,
  onAdd,
  onDelete,
  onRename,
  onToggleVisible,
  onMove,
}: {
  layers: LayerData[];
  activeLayerId: string;
  onActivate: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleVisible: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  // Top → bottom in the panel = top → bottom in the visible stack,
  // which means we render the array reversed (last layer = paints
  // on top of everything).
  const [editingId, setEditingId] = useState<string | null>(null);
  const reversed = [...layers].reverse();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '10px 12px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          onClick={onAdd}
          title="Agregar capa nueva (vacía, encima de las demás)"
          style={{
            padding: '4px 10px',
            background: 'var(--color-accent)',
            color: '#0a0a14',
            border: '2px solid var(--color-accent)',
            fontFamily: "'Silkscreen', cursive",
            fontSize: '0.55rem',
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          + Nueva capa
        </button>
      </div>
      <div
        style={{
          overflowY: 'auto',
          padding: '0 8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {reversed.map((l) => {
          const isActive = l.id === activeLayerId;
          const isVisible = l.visible !== false;
          const tileCount = l.tiles.length;
          return (
            <div
              key={l.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: 6,
                background: isActive ? 'var(--color-accent)' : '#1a1a1a',
                color: isActive ? '#0a0a14' : '#e5e5e5',
                border: '2px solid var(--color-accent)',
              }}
            >
              <button
                type="button"
                title={isVisible ? 'Ocultar' : 'Mostrar'}
                onClick={() => l.id && onToggleVisible(l.id)}
                style={{
                  width: 22,
                  height: 22,
                  background: isVisible ? '#0a0a14' : '#3a1a1a',
                  border: '1px solid rgba(75,45,142,0.6)',
                  color: isVisible ? '#e5e5e5' : 'rgba(225,215,255,0.4)',
                  fontFamily: "'Silkscreen', cursive",
                  fontSize: '0.6rem',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isVisible ? '◉' : '○'}
              </button>
              <button
                type="button"
                onClick={() => l.id && onActivate(l.id)}
                onDoubleClick={() => l.id && setEditingId(l.id)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  textAlign: 'left',
                  fontFamily: "'Silkscreen', cursive",
                  fontSize: '0.6rem',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  minWidth: 0,
                }}
              >
                {editingId === l.id ? (
                  <input
                    type="text"
                    autoFocus
                    defaultValue={l.name ?? ''}
                    onBlur={(e) => {
                      if (l.id) onRename(l.id, e.target.value || 'Capa');
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '2px 4px',
                      background: '#0a0a14',
                      border: '1px solid var(--color-accent)',
                      color: '#e5e5e5',
                      fontFamily: "'Silkscreen', cursive",
                      fontSize: '0.6rem',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <>
                    <span>{l.name ?? '(sin nombre)'}</span>
                    <span
                      style={{
                        fontSize: '0.45rem',
                        opacity: 0.65,
                      }}
                    >
                      {tileCount} tiles
                    </span>
                  </>
                )}
              </button>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                <button
                  type="button"
                  title="Subir capa"
                  onClick={() => l.id && onMove(l.id, 1)}
                  style={miniButtonStyle}
                >
                  ▲
                </button>
                <button
                  type="button"
                  title="Bajar capa"
                  onClick={() => l.id && onMove(l.id, -1)}
                  style={miniButtonStyle}
                >
                  ▼
                </button>
              </div>
              <button
                type="button"
                title="Borrar capa"
                onClick={() => {
                  if (!l.id) return;
                  if (
                    layers.length > 1 &&
                    window.confirm(`¿Borrar "${l.name ?? 'capa'}"?`)
                  ) {
                    onDelete(l.id);
                  }
                }}
                disabled={layers.length <= 1}
                style={{
                  ...miniButtonStyle,
                  width: 22,
                  height: 22,
                  color: layers.length > 1 ? '#ff8080' : 'rgba(255,128,128,0.3)',
                  cursor: layers.length > 1 ? 'pointer' : 'not-allowed',
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const miniButtonStyle: React.CSSProperties = {
  width: 22,
  height: 11,
  background: 'rgba(10,10,20,0.85)',
  border: '1px solid rgba(75,45,142,0.6)',
  color: '#e5e5e5',
  fontFamily: "'Silkscreen', cursive",
  fontSize: '0.45rem',
  cursor: 'pointer',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

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
