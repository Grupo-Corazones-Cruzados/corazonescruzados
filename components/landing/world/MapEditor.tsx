'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import PixelConfirm from '@/components/ui/PixelConfirm';
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
import { loadChromaKeyedSheet } from './sheetLoader';
import { PanelHeader, SearchInput, SegmentedTabs } from './editorUi';
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
  color?: string; // solid color tile (overrides sheet)
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

// Solid-color brush — stamps a single tile of `color` at the cursor.
// Uses sentinel sheet/sx/sy of 0 because the renderer ignores those
// fields when `color` is set on a tile.
function colorBrush(color: string): Brush {
  return {
    w: 1,
    h: 1,
    source: 'sheet',
    tiles: [{ dx: 0, dy: 0, s: 0, sx: 0, sy: 0, color }],
    key: `color:${color}`,
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

// Zoom is dynamic in the editor: it opens fitting the whole map to the
// viewport and the user can zoom in/out from the status bar. These bound
// how far the slider/buttons can push it. 1 unit = 1 source px → 1 screen px.
const DEFAULT_VIEW_SCALE = 2;
const MIN_VIEW_SCALE = 0.1;
const MAX_VIEW_SCALE = 6;
const ZOOM_STEP = 1.25; // multiplicative factor per +/- click
const CANVAS_PAD = 24; // padding around the canvas inside the scroll container

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
  // Ribbon tab — like Word's tab strip (Inicio / Insertar / Diseño /
  // Vista). The active tab decides which group of commands renders
  // underneath the tab bar.
  const [ribbonTab, setRibbonTab] = useState<
    'inicio' | 'insertar' | 'diseño' | 'vista'
  >('inicio');

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
  // Live zoom factor for the editor canvas. Starts at the default but the
  // mount effect immediately recomputes it to fit the whole map.
  const [viewScale, setViewScale] = useState(DEFAULT_VIEW_SCALE);
  // Last cell the user clicked while editing — the zoom controls recenter
  // the viewport on this cell so zooming homes in on the area being worked.
  const lastClickCellRef = useRef<{ x: number; y: number } | null>(null);
  // Pending recenter target consumed by the layout effect once `viewScale`
  // has been applied to the DOM (we need the post-zoom scroll dimensions).
  const zoomFocusRef = useRef<{ x: number; y: number } | null>(null);
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
    'tiles' | 'items' | 'props' | 'colors'
  >('tiles');
  // Color brush — when set and the user paints, a solid-color tile
  // of this hex is stamped instead of a sheet sprite.
  const [colorBrushHex, setColorBrushHex] = useState<string | null>(null);
  // Expanded section keys for the asset palette (sheet ids in the
  // Tiles tab; item-category ids in Items/Props). Empty by default →
  // every section starts collapsed so the panel stays scannable.
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
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
  //   Q W E R T Y: paint / erase / copy / collision / view-collisions
  //                / spawn (top-row QWERTY layout).
  //   L: light. P: prop.
  //   ⌘S / Ctrl+S: save.
  //   ⌘Z / Ctrl+Z: undo. ⌘⇧Z / Ctrl+⇧Z: redo.
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
        // QWERTY row mapped to the most-used tools.
        case 'q':
          e.preventDefault();
          setMode('paint');
          return;
        case 'w':
          e.preventDefault();
          setMode('erase');
          return;
        case 'e':
          e.preventDefault();
          setMode('copy');
          return;
        case 'r':
          e.preventDefault();
          setMode('collision');
          return;
        case 't':
          e.preventDefault();
          setShowCollisions((v) => !v);
          return;
        case 'y':
          e.preventDefault();
          setMode('spawn');
          return;
        // Other modes (less frequent — Insertar tab):
        case 'l':
          e.preventDefault();
          setMode('light');
          return;
        case 'p':
          e.preventDefault();
          setMode('prop');
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
    Promise.all(SHEETS.map((s) => loadChromaKeyedSheet(s.url))).then((loaded) => {
      if (!cancelled) setImgs(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Canvas render ──────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ── Zoom / viewport ───────────────────────────────────────────
  // Tile under the centre of the visible viewport, in fractional tile
  // coords. Used as the zoom focus when the user hasn't clicked yet.
  const viewCenterTile = useCallback(() => {
    const c = containerRef.current;
    if (!c) return { x: width / 2 - 0.5, y: height / 2 - 0.5 };
    const px = c.scrollLeft + c.clientWidth / 2 - CANVAS_PAD;
    const py = c.scrollTop + c.clientHeight / 2 - CANVAS_PAD;
    return {
      x: Math.min(Math.max(px / (TILE_PX * viewScale) - 0.5, 0), width - 1),
      y: Math.min(Math.max(py / (TILE_PX * viewScale) - 0.5, 0), height - 1),
    };
  }, [viewScale, width, height]);

  // Scroll so `focus` (a tile coord) sits at the viewport centre for the
  // given scale. The browser clamps scrollLeft/Top into range for us.
  const recenterOn = useCallback(
    (focus: { x: number; y: number }, scale: number) => {
      const c = containerRef.current;
      if (!c) return;
      c.scrollLeft =
        CANVAS_PAD + (focus.x + 0.5) * TILE_PX * scale - c.clientWidth / 2;
      c.scrollTop =
        CANVAS_PAD + (focus.y + 0.5) * TILE_PX * scale - c.clientHeight / 2;
    },
    [],
  );

  // Set the zoom, clamped, and remember where to recenter once the new
  // size has been laid out (see the layout effect below).
  const applyZoom = useCallback(
    (next: number, focus?: { x: number; y: number }) => {
      const clamped = Math.min(
        Math.max(next, MIN_VIEW_SCALE),
        MAX_VIEW_SCALE,
      );
      zoomFocusRef.current =
        focus ?? lastClickCellRef.current ?? viewCenterTile();
      setViewScale(clamped);
    },
    [viewCenterTile],
  );

  // Zoom level that makes the whole map fit inside the viewport, then
  // centre it. Returns false if the container isn't measurable yet.
  const fitToScreen = useCallback(() => {
    const c = containerRef.current;
    if (!c || c.clientWidth === 0 || c.clientHeight === 0) return false;
    const scale = Math.min(
      (c.clientWidth - CANVAS_PAD * 2) / (width * TILE_PX),
      (c.clientHeight - CANVAS_PAD * 2) / (height * TILE_PX),
    );
    applyZoom(scale, { x: width / 2 - 0.5, y: height / 2 - 0.5 });
    return true;
  }, [width, height, applyZoom]);

  // After a zoom changes the canvas size, apply the pending recenter so
  // the focus point stays under the user's eye instead of drifting.
  useLayoutEffect(() => {
    const focus = zoomFocusRef.current;
    if (!focus) return;
    zoomFocusRef.current = null;
    recenterOn(focus, viewScale);
  }, [viewScale, recenterOn]);

  // On open, fit the whole map to the viewport. The container may not be
  // measurable on the first frame (hidden / still laying out), so retry
  // on the next few animation frames until it is.
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const attempt = () => {
      if (fitToScreen() || tries++ > 30) return;
      raf = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    ctx.fillStyle = '#f3f2f1';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render every visible layer in array order (bottom → top). Within
    // each layer we still split into ground (z=0) then overlay (z=1)
    // so legacy maps with mixed-category tiles in a single layer keep
    // their stacking. Non-active layers dim slightly to keep focus on
    // the layer the user is actually painting.
    const drawTile = (t: Tile, alpha: number) => {
      ctx.globalAlpha = alpha;
      if (t.color) {
        // Solid-color tile painted from the Colores palette. Skip the
        // sheet lookup entirely.
        ctx.fillStyle = t.color;
        ctx.fillRect(t.x * TILE_PX, t.y * TILE_PX, TILE_PX, TILE_PX);
      } else {
        const sheet = SHEETS[t.s];
        const img = imgs[t.s];
        if (!sheet || !img) {
          ctx.globalAlpha = 1;
          return;
        }
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
      }
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
    ctx.strokeStyle = 'rgba(50,49,48,0.08)';
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
      ctx.fillStyle = 'rgba(50,49,48,0.12)';
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
        ctx.strokeStyle = '#0078d4';
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
      ctx.fillStyle = '#faf9f8';
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
      ctx.fillStyle = '#faf9f8';
      ctx.beginPath();
      ctx.arc(lcx, lcy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.arc(lcx, lcy, 5, 0, Math.PI * 2);
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = '#0078d4';
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
      ctx.strokeStyle = isSel ? '#0078d4' : '#ff80f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        t.x * TILE_PX + 1,
        t.y * TILE_PX + 1,
        t.w * TILE_PX - 2,
        t.h * TILE_PX - 2,
      );
      ctx.fillStyle = '#faf9f8';
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
    const cx = Math.floor((clientX - rect.left) / (TILE_PX * viewScale));
    const cy = Math.floor((clientY - rect.top) / (TILE_PX * viewScale));
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return null;
    return { x: cx, y: cy };
  };

  const paintAt = (clientX: number, clientY: number) => {
    const cell = cellFromClient(clientX, clientY);
    if (!cell) return;
    // Remember where the user is working so the zoom controls can home
    // in on this area instead of the map centre.
    lastClickCellRef.current = cell;
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
        if (bt.color) newTile.color = bt.color;
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
        toast.error(j?.error ?? 'No se pudo guardar');
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
        background: '#faf9f8',
        color: '#323130',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        display: 'grid',
        gridTemplateColumns: asideVisible ? '300px 1fr 220px' : '1fr 220px',
        animation: embedded ? undefined : 'pixelFadeIn 0.4s ease-out',
      }}
    >
      <aside
        style={{
          background: '#ffffff',
          borderRight: '1px solid #d1d1d1',
          display: asideVisible ? 'flex' : 'none',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <PanelHeader title="Editor del mundo">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar (sheet, categoría)…"
          />
        </PanelHeader>

        <div style={{ padding: '8px 10px 6px' }}>
          <SegmentedTabs
            value={activeTab}
            onChange={(t) => {
              setActiveTab(t);
              if (t === 'tiles') {
                setItemBrush(null);
                setPropBrushItemId(null);
                setColorBrushHex(null);
                setMode('paint');
              } else if (t === 'items') {
                setBrush(null);
                setPropBrushItemId(null);
                setColorBrushHex(null);
                setMode('paint');
              } else if (t === 'props') {
                setBrush(null);
                setItemBrush(null);
                setColorBrushHex(null);
                setMode('prop');
              } else {
                setItemBrush(null);
                setPropBrushItemId(null);
                setMode('paint');
              }
            }}
            tabs={[
              { value: 'tiles', label: 'Tiles' },
              { value: 'items', label: 'Items' },
              { value: 'props', label: 'Props' },
              { value: 'colors', label: 'Colores' },
            ]}
          />
        </div>

        {activeTab === 'tiles' && (
          <div
            style={{
              padding: 10,
              borderBottom: '1px solid #edebe9',
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
                background: '#f3f2f1',
                color: '#323130',
                border: '1px solid #d1d1d1',
                fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                fontSize: '0.78rem',
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
              const key = `item:${cat.id}`;
              // When the user is actively searching, force-expand
              // matching sections so results stay visible.
              const expanded =
                !!filteredQuery || expandedSections.has(key);
              return (
                <div key={cat.id}>
                  <CollapseHeader
                    label={cat.label}
                    count={itemsInCat.length}
                    expanded={expanded}
                    onToggle={() => toggleSection(key)}
                  />
                  {expanded && (
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
                            background: active ? '#deecf9' : '#faf9f8',
                            border: active
                              ? '2px solid #0078d4'
                              : '1px solid #d1d1d1',
                            cursor: 'pointer',
                            padding: active ? 3 : 4,
                            boxShadow: 'none',
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
                  )}
                </div>
              );
            })}
          {activeTab === 'props' && (
            <>
              <div
                style={{
                  fontSize: '0.72rem',
                  letterSpacing: '0.12em',
                  color: 'rgba(50,49,48,0.7)',
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
                const key = `prop:${cat.id}`;
                const expanded =
                  !!filteredQuery || expandedSections.has(key);
                return (
                  <div key={cat.id}>
                    <CollapseHeader
                      label={cat.label}
                      count={itemsInCat.length}
                      expanded={expanded}
                      onToggle={() => toggleSection(key)}
                    />
                    {expanded && (
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
                              background: '#faf9f8',
                              border: active
                                ? '1px solid #d1d1d1'
                                : '1px solid #d1d1d1',
                              cursor: 'pointer',
                              padding: 4,
                              boxShadow: active
                                ? '0 0 8px #0078d4'
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
                    )}
                  </div>
                );
              })}
            </>
          )}
          {activeTab === 'colors' && (
            <ColorsPalette
              activeColor={colorBrushHex}
              onPick={(c) => {
                setColorBrushHex(c);
                setBrush(colorBrush(c));
                setItemBrush(null);
                setPropBrushItemId(null);
                setMode('paint');
              }}
            />
          )}
          {activeTab === 'tiles' && (
            <div
              style={{
                fontSize: '0.72rem',
                color: '#605e5c',
                lineHeight: 1.5,
                padding: '0 2px 4px',
              }}
            >
              <strong style={{ color: '#323130' }}>Tip:</strong> arrastra
              dentro de un sheet para seleccionar varios tiles a la vez
              (ej: un árbol de 2×3). Suelta y clic en el mapa para
              estamparlo completo.
            </div>
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
              const key = `sheet:${sheet.id}`;
              const expanded =
                !!filteredQuery || expandedSections.has(key);
              return (
                <div key={sheet.id}>
                  <CollapseHeader
                    label={`${sheet.name} · ${sheet.cols}×${sheet.rows}`}
                    expanded={expanded}
                    onToggle={() => toggleSection(key)}
                  />
                  {expanded && (
                    <SheetPalette
                      sheet={sheet}
                      sheetIdx={sheetIdx}
                      selected={
                        brush?.source === 'sheet' &&
                        brush.sheetIdx === sheetIdx &&
                        brush.sx != null &&
                        brush.sy != null
                          ? {
                              sx: brush.sx,
                              sy: brush.sy,
                              w: brush.w,
                              h: brush.h,
                            }
                          : null
                      }
                      onPick={(b) => {
                        activateBrush(b);
                      }}
                    />
                  )}
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
        {/* Quick Access Toolbar — always visible above ribbon tabs.
            Hosts the highest-frequency actions: save, undo, redo,
            plus a scene readout on the right. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 12px',
            borderBottom: '1px solid #edebe9',
            background: '#faf9f8',
            minHeight: 32,
          }}
        >
          <QatButton
            icon="💾"
            label={saving ? 'Guardando…' : 'Guardar (⌘S)'}
            onClick={save}
            disabled={saving}
          />
          <QatButton
            icon="↶"
            label="Deshacer (⌘Z)"
            onClick={undo}
            disabled={historyIdx <= 0}
          />
          <QatButton
            icon="↷"
            label="Rehacer (⌘⇧Z)"
            onClick={redo}
            disabled={historyIdx >= history.length - 1}
          />
          <div style={{ flex: 1 }} />
          {savedAt && (
            <span
              style={{
                fontSize: '0.78rem',
                color: '#107c10',
                letterSpacing: '0.02em',
              }}
            >
              ✓ Guardado
            </span>
          )}
          {brush && mode === 'paint' && (
            <BrushPreview brush={brush} imgs={imgs} />
          )}
        </div>

        {/* Ribbon tabs — Word-style. Active tab swaps the ribbon body
            underneath. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 0,
            padding: '0 12px',
            background: '#faf9f8',
            borderBottom: '1px solid #edebe9',
          }}
        >
          {(
            [
              { id: 'inicio', label: 'Inicio' },
              { id: 'insertar', label: 'Insertar' },
              { id: 'diseño', label: 'Diseño' },
              { id: 'vista', label: 'Vista' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setRibbonTab(t.id)}
              style={{
                padding: '8px 18px',
                fontSize: '0.85rem',
                fontFamily:
                  'system-ui, -apple-system, "Segoe UI", sans-serif',
                background:
                  ribbonTab === t.id ? '#ffffff' : 'transparent',
                color: ribbonTab === t.id ? '#0078d4' : '#323130',
                border: 'none',
                borderBottom:
                  ribbonTab === t.id
                    ? '1px solid #d1d1d1'
                    : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: ribbonTab === t.id ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Ribbon body — content depends on the active tab. Each tab
            renders one or more RibbonGroup blocks (group of related
            commands + small caption underneath, vertical separator). */}
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 0,
            padding: '8px 12px',
            background: '#ffffff',
            borderBottom: '1px solid #edebe9',
            minHeight: 96,
          }}
        >
          {ribbonTab === 'inicio' && (
            <>
              <RibbonGroup label="Pintar">
                <RibbonButton
                  icon="✎"
                  label="Pintar"
                  hotkey="Q"
                  active={mode === 'paint'}
                  onClick={() => setMode('paint')}
                />
                <RibbonButton
                  icon="✕"
                  label="Borrar"
                  hotkey="W"
                  active={mode === 'erase'}
                  onClick={() => setMode('erase')}
                />
                <RibbonButton
                  icon="▭"
                  label="Copiar"
                  hotkey="E"
                  active={mode === 'copy'}
                  onClick={() => setMode('copy')}
                />
              </RibbonGroup>
              <RibbonGroup label="Tile">
                <RibbonButton
                  icon="▥"
                  label="Colisión"
                  hotkey="R"
                  active={mode === 'collision'}
                  onClick={() => setMode('collision')}
                />
                <RibbonButton
                  icon="◉"
                  label="Ver colisiones"
                  hotkey="T"
                  active={showCollisions}
                  onClick={() => setShowCollisions((v) => !v)}
                />
              </RibbonGroup>
              <RibbonGroup label="Spawn">
                <RibbonButton
                  icon="◎"
                  label="Posición inicial"
                  hotkey="Y"
                  active={mode === 'spawn'}
                  onClick={() => setMode('spawn')}
                />
              </RibbonGroup>
            </>
          )}
          {ribbonTab === 'insertar' && (
            <>
              <RibbonGroup label="Objetos del mundo">
                <RibbonButton
                  icon="◆"
                  label="Prop"
                  hotkey="P"
                  active={mode === 'prop'}
                  onClick={() => setMode('prop')}
                />
              </RibbonGroup>
              <RibbonGroup label="Especiales">
                <RibbonButton
                  icon="☼"
                  label="Luz"
                  hotkey="L"
                  active={mode === 'light'}
                  onClick={() => setMode('light')}
                />
                <RibbonButton
                  icon="↦"
                  label="Transición"
                  hotkey=""
                  active={mode === 'transition'}
                  onClick={() => setMode('transition')}
                />
              </RibbonGroup>
            </>
          )}
          {ribbonTab === 'diseño' && (
            <>
              <RibbonGroup label="Tamaño del mapa">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 0',
                  }}
                >
                  <span style={{ fontSize: '0.78rem', color: '#605e5c' }}>
                    Ancho
                  </span>
                  <NumberInput
                    value={width}
                    min={5}
                    max={500}
                    onChange={setWidth}
                    onCommit={pushHistory}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 0',
                  }}
                >
                  <span style={{ fontSize: '0.78rem', color: '#605e5c' }}>
                    Alto
                  </span>
                  <NumberInput
                    value={height}
                    min={5}
                    max={500}
                    onChange={setHeight}
                    onCommit={pushHistory}
                  />
                </div>
              </RibbonGroup>
            </>
          )}
          {ribbonTab === 'vista' && (
            <>
              <RibbonGroup label="Capas y tile">
                <RibbonButton
                  icon="◉"
                  label="Mostrar colisiones"
                  hotkey="T"
                  active={showCollisions}
                  onClick={() => setShowCollisions((v) => !v)}
                />
              </RibbonGroup>
              <RibbonGroup label="Iluminación">
                <div style={{ position: 'relative' }}>
                  <RibbonButton
                    icon={lightingPreview ? '☾' : '☀'}
                    label="Oscuridad"
                    hotkey=""
                    active={lightingPreview}
                    onClick={() => setLightingPreview((v) => !v)}
                  />
                  {lightingPreview && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        background: '#ffffff',
                        border: '1px solid #edebe9',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        zIndex: 50,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        whiteSpace: 'nowrap',
                        borderRadius: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: '#605e5c',
                          letterSpacing: '0.02em',
                        }}
                      >
                        Intensidad de la oscuridad
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={ambientDarkness}
                          onChange={(e) =>
                            setAmbientDarkness(Number(e.target.value))
                          }
                          style={{
                            width: 180,
                            accentColor: '#0078d4',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.78rem',
                            color: '#323130',
                            fontFamily: 'monospace',
                            minWidth: 36,
                          }}
                        >
                          {Math.round(ambientDarkness * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </RibbonGroup>
            </>
          )}
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#edebe9',
            padding: CANVAS_PAD,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: width * TILE_PX * viewScale,
              height: height * TILE_PX * viewScale,
            }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={(e) => {
                if (mode === 'copy') {
                  const c = cellFromClient(e.clientX, e.clientY);
                  if (!c) return;
                  lastClickCellRef.current = c;
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
                width: width * TILE_PX * viewScale,
                height: height * TILE_PX * viewScale,
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

        {/* Status bar — Word-style. Surfaces map metadata + current
            mode so the user can verify what's selected at a glance. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '4px 14px',
            borderTop: '1px solid #edebe9',
            background: '#0078d4',
            color: '#ffffff',
            fontSize: '0.75rem',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            minHeight: 26,
          }}
        >
          <span>{scene?.name ?? sceneSlug}</span>
          <StatusSep />
          <span>
            {width} × {height}
          </span>
          <StatusSep />
          <span>
            Spawn ({spawnX}, {spawnY})
          </span>
          <StatusSep />
          <span>{layers.length} capa{layers.length === 1 ? '' : 's'}</span>
          <StatusSep />
          <span>{(worldMapItems(items)).length} items</span>
          <StatusSep />
          <span>{props.length} props</span>
          <div style={{ flex: 1 }} />
          <span style={{ opacity: 0.9 }}>
            Modo: <strong style={{ color: '#ffffff' }}>{modeLabel(mode)}</strong>
          </span>
          <StatusSep />
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title="El editor abre mostrando todo el mapa. Acercá/alejá con
estos controles: el zoom se centra en la última celda en la que hiciste clic."
          >
            <button
              type="button"
              onClick={() => fitToScreen()}
              title="Ajustar todo el mapa a la pantalla"
              style={zoomBtnStyle}
            >
              Ajustar
            </button>
            <button
              type="button"
              onClick={() => applyZoom(viewScale / ZOOM_STEP)}
              title="Alejar (zoom sobre la última celda clickeada)"
              aria-label="Alejar"
              style={zoomIconBtnStyle}
            >
              −
            </button>
            <input
              type="range"
              min={MIN_VIEW_SCALE}
              max={MAX_VIEW_SCALE}
              step={0.05}
              value={viewScale}
              onChange={(e) => applyZoom(Number(e.target.value))}
              title="Nivel de zoom"
              style={{ width: 110, accentColor: '#ffffff', cursor: 'pointer' }}
            />
            <button
              type="button"
              onClick={() => applyZoom(viewScale * ZOOM_STEP)}
              title="Acercar (zoom sobre la última celda clickeada)"
              aria-label="Acercar"
              style={zoomIconBtnStyle}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => applyZoom(1)}
              title="Zoom 100 %"
              style={{ ...zoomBtnStyle, minWidth: 46, textAlign: 'center' }}
            >
              {Math.round(viewScale * 100)}%
            </button>
          </div>
        </div>
      </main>

      {/* ── Right aside: Layers (always visible) ── */}
      <aside
        style={{
          background: '#ffffff',
          borderLeft: '1px solid #d1d1d1',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
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
      </aside>

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
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          border: '1px solid #d1d1d1',
          padding: 18,
          width: 360,
          color: '#323130',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: '1rem',
            letterSpacing: '0.18em',
            color: '#0078d4',
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
            style={{ width: '100%', accentColor: '#0078d4' }}
          />
        </Field>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            type="button"
            onClick={onDelete}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: '#fde7e9',
              color: '#a4262c',
              border: '2px solid #a4262c',
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
              fontSize: '0.78rem',
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
              background: '#ffffff',
              color: '#323130',
              border: '1px solid #d1d1d1',
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
              fontSize: '0.78rem',
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
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          border: '1px solid #d1d1d1',
          padding: 18,
          width: 420,
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#323130',
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
                background: '#faf9f8',
                border: '1px solid #d1d1d1',
                padding: 3,
              }}
            />
          )}
          <div>
            <div
              style={{
                fontSize: '1rem',
                letterSpacing: '0.18em',
                color: '#0078d4',
                textTransform: 'uppercase',
              }}
            >
              Prop ◆
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: 'rgba(50,49,48,0.6)',
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
            background: '#faf9f8',
            border: '1px solid #edebe9',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={!!draft.solid}
            onChange={(e) => update({ solid: e.target.checked })}
          />
          <span style={{ fontSize: '0.8rem', letterSpacing: '0.12em' }}>
            Sólido (bloquea al jugador)
          </span>
        </label>

        {/* Light */}
        <div
          style={{
            border: '1px solid #edebe9',
            padding: 10,
            background: '#faf9f8',
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
            <span style={{ fontSize: '0.85rem', letterSpacing: '0.12em' }}>
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
                  style={{ width: '100%', accentColor: '#0078d4' }}
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
                  style={{ width: '100%', accentColor: '#0078d4' }}
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
                  style={{ width: '100%', accentColor: '#0078d4' }}
                />
              </Field>
            </div>
          )}
        </div>

        {/* Trigger */}
        <div
          style={{
            border: '1px solid #edebe9',
            padding: 10,
            background: '#faf9f8',
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
            <span style={{ fontSize: '0.85rem', letterSpacing: '0.12em' }}>
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
                    onChange={(e) => {
                      const tc = draft.trigger as Extract<
                        PropTrigger,
                        { kind: 'cinematic' }
                      >;
                      update({
                        trigger: { ...tc, cinematicSlug: e.target.value },
                      });
                    }}
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
                      onChange={(e) => {
                        const tc = draft.trigger as Extract<
                          PropTrigger,
                          { kind: 'tile-change' }
                        >;
                        update({
                          trigger: { ...tc, layerId: e.target.value },
                        });
                      }}
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
                        onChange={(e) => {
                          const tc = draft.trigger as Extract<
                            PropTrigger,
                            { kind: 'tile-change' }
                          >;
                          update({
                            trigger: {
                              ...tc,
                              tileX: Math.max(
                                0,
                                Math.floor(Number(e.target.value) || 0),
                              ),
                            },
                          });
                        }}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Tile Y destino">
                      <input
                        type="number"
                        value={draft.trigger.tileY}
                        onChange={(e) => {
                          const tc = draft.trigger as Extract<
                            PropTrigger,
                            { kind: 'tile-change' }
                          >;
                          update({
                            trigger: {
                              ...tc,
                              tileY: Math.max(
                                0,
                                Math.floor(Number(e.target.value) || 0),
                              ),
                            },
                          });
                        }}
                        style={inputStyle}
                      />
                    </Field>
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'rgba(50,49,48,0.55)',
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
                    onChange={(e) => {
                      const tc = draft.trigger as Extract<
                        PropTrigger,
                        { kind: 'layer-toggle' }
                      >;
                      update({
                        trigger: { ...tc, layerId: e.target.value },
                      });
                    }}
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
                  fontSize: '0.78rem',
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
              background: '#fde7e9',
              color: '#a4262c',
              border: '2px solid #a4262c',
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
              fontSize: '0.78rem',
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
              background: '#ffffff',
              color: '#323130',
              border: '1px solid #d1d1d1',
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
              fontSize: '0.78rem',
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
          color: 'rgba(50,49,48,0.65)',
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
  background: '#faf9f8',
  color: '#323130',
  border: '1px solid #d1d1d1',
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontSize: '0.78rem',
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
          background: '#f3f2f1',
          border: '1px solid #d1d1d1',
          padding: 20,
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          color: '#323130',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '6px 6px 0 rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            fontSize: '1rem',
            letterSpacing: '0.2em',
            color: '#0078d4',
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
              border: '1px solid #d1d1d1',
              background: '#faf9f8',
              cursor: 'pointer',
            }}
          />
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: 'rgba(50,49,48,0.7)',
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
            style={{ flex: 1, accentColor: '#0078d4' }}
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
            style={{ flex: 1, accentColor: '#0078d4' }}
          />
        </ModalField>

        <ModalField label="Modo">
          <select
            value={draft.mode}
            onChange={(e) => update({ mode: e.target.value as LightMode })}
            style={{
              padding: '6px 8px',
              background: '#faf9f8',
              border: '1px solid #d1d1d1',
              color: '#323130',
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
              fontSize: '0.8rem',
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
              style={{ flex: 1, accentColor: '#0078d4' }}
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
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '0.9rem',
              background: '#0078d4',
              color: '#323130',
              border: 'none',
              borderRadius: 4,
              fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Listo
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={{
              padding: '8px 12px',
              fontSize: '0.9rem',
              background: '#fde7e9',
              color: '#a4262c',
              border: '1px solid #a4262c',
              borderRadius: 4,
              fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
              cursor: 'pointer',
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
          fontSize: '0.72rem',
          letterSpacing: '0.16em',
          color: 'rgba(50,49,48,0.6)',
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
  background: '#faf9f8',
  border: '1px solid #d1d1d1',
  color: '#323130',
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontSize: '0.8rem',
  outline: 'none',
};

// Curated swatch palette grouped by use case. Hex values follow
// Microsoft Fluent and common map-building conventions. The user can
// also pick any custom hex via the <input type="color"> below.
const COLOR_GROUPS: { label: string; colors: string[] }[] = [
  {
    label: 'Terreno',
    colors: [
      '#5fa84a', // grass
      '#3e7733', // dark grass
      '#a8c98f', // pale grass
      '#8b5a2b', // dirt
      '#5a3a1a', // dark dirt
      '#e6d59c', // sand
      '#c0a96f', // dark sand
      '#4d3f2a', // mud
    ],
  },
  {
    label: 'Piedra',
    colors: [
      '#bdbdbd',
      '#8a8a8a',
      '#5e5e5e',
      '#3a3a3a',
      '#1c1c1c',
      '#c2b5a3',
    ],
  },
  {
    label: 'Agua',
    colors: ['#6ec6ff', '#1e88e5', '#0d47a1', '#00897b', '#26c6da'],
  },
  {
    label: 'Madera',
    colors: ['#a87c4d', '#6b4a26', '#3a2812', '#d2a679', '#f0d8b3'],
  },
  {
    label: 'Acentos',
    colors: [
      '#e53935', // red
      '#fb8c00', // orange
      '#ffd54f', // yellow
      '#9ccc65', // light green
      '#6a1b9a', // purple
      '#f06292', // pink
    ],
  },
  {
    label: 'Neutros',
    colors: ['#ffffff', '#f4f4f4', '#d8d4c8', '#7a7a7a', '#000000'],
  },
];

function ColorsPalette({
  activeColor,
  onPick,
}: {
  activeColor: string | null;
  onPick: (color: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          fontSize: '0.78rem',
          color: '#605e5c',
          lineHeight: 1.5,
        }}
      >
        Elige un color y clic en el mapa para pintar un tile sólido.
        Funciona con la herramienta Pintar y respeta la capa activa.
      </div>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#f3f2f1',
          padding: '8px 12px',
          border: '1px solid #d1d1d1',
          borderRadius: 2,
        }}
      >
        <span
          style={{
            fontSize: '0.78rem',
            color: '#323130',
            fontWeight: 500,
          }}
        >
          Color personalizado
        </span>
        <input
          type="color"
          value={activeColor ?? '#5fa84a'}
          onChange={(e) => onPick(e.target.value)}
          style={{
            width: 40,
            height: 28,
            border: '1px solid #d1d1d1',
            padding: 0,
            cursor: 'pointer',
            background: 'transparent',
          }}
        />
        <span
          style={{
            flex: 1,
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            color: '#323130',
          }}
        >
          {activeColor ?? '#5fa84a'}
        </span>
      </label>
      {COLOR_GROUPS.map((g) => (
        <div key={g.label}>
          <div
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.04em',
              color: '#605e5c',
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            {g.label}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, 40px)',
              gap: 6,
            }}
          >
            {g.colors.map((c) => {
              const active =
                !!activeColor &&
                activeColor.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  title={c}
                  aria-label={c}
                  onClick={() => onPick(c)}
                  style={{
                    width: 40,
                    height: 40,
                    background: c,
                    border: active
                      ? '2px solid #0078d4'
                      : '1px solid #d1d1d1',
                    cursor: 'pointer',
                    padding: 0,
                    borderRadius: 2,
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Section header shared by the Tiles / Items / Props tabs. Behaves
// like a Word-style accordion: chevron + label + optional count
// badge, full-width clickable area, subtle hover wash. Active search
// queries force-expand sections from the outside (handled by callers).
function CollapseHeader({
  label,
  count,
  expanded,
  onToggle,
}: {
  label: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        marginBottom: 6,
        background: hover ? '#f3f2f1' : 'transparent',
        border: 'none',
        borderRadius: 2,
        cursor: 'pointer',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 16,
          display: 'inline-grid',
          placeItems: 'center',
          color: '#605e5c',
          fontSize: '0.7rem',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 120ms ease',
        }}
      >
        ▶
      </span>
      <span
        style={{
          flex: 1,
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#323130',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      {typeof count === 'number' && (
        <span
          style={{
            fontSize: '0.72rem',
            color: '#605e5c',
            padding: '0 6px',
            background: '#edebe9',
            borderRadius: 10,
            minWidth: 18,
            textAlign: 'center',
          }}
        >
          {count}
        </span>
      )}
    </button>
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
        background: '#faf9f8',
        border: '1px solid rgba(0,120,212,0.4)',
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
            border: '1px solid #d1d1d1',
            boxShadow: '0 0 6px #0078d4',
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
      ctx.strokeStyle = '#0078d4';
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
      if (bt.color) {
        ctx.fillStyle = bt.color;
        ctx.fillRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
        return;
      }
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
        fontSize: '0.72rem',
        color: 'rgba(50,49,48,0.7)',
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
        border: '1px solid #d1d1d1',
        background: '#faf9f8',
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
        background: active ? '#0078d4' : '#ffffff',
        color: active
          ? '#ffffff'
          : disabled
            ? 'rgba(50,49,48,0.3)'
            : '#323130',
        border: active ? '1px solid #0078d4' : '1px solid #d1d1d1',
        boxShadow: 'none',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
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
          color: active ? '#ffffff' : 'rgba(50,49,48,0.6)',
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
        background: '#f3f2f1',
        border: '1px solid #d1d1d1',
        color: '#323130',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: '0.8rem',
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
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
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
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #edebe9',
        }}
      >
        <span
          style={{
            fontSize: '0.78rem',
            color: '#605e5c',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          {reversed.length} capa{reversed.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onAdd}
          title="Agregar capa nueva (vacía, encima de las demás)"
          style={{
            padding: '5px 12px',
            background: '#0078d4',
            color: '#ffffff',
            border: '1px solid #0078d4',
            borderRadius: 2,
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: '0.78rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          + Nueva
        </button>
      </div>
      <div
        style={{
          overflowY: 'auto',
          padding: '4px 0 12px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {reversed.map((l, idx) => {
          const isActive = l.id === activeLayerId;
          const isVisible = l.visible !== false;
          const tileCount = l.tiles.length;
          // Layer index in the actual stack (bottom = 0).
          const stackIdx = layers.length - 1 - idx;
          const canMoveUp = stackIdx < layers.length - 1;
          const canMoveDown = stackIdx > 0;
          return (
            <div
              key={l.id}
              onClick={() => l.id && onActivate(l.id)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 8px 8px 12px',
                background: isActive ? '#deecf9' : 'transparent',
                borderLeft: isActive
                  ? '3px solid #0078d4'
                  : '3px solid transparent',
                cursor: 'pointer',
              }}
            >
              <RowAction
                icon={isVisible ? '👁' : '⊘'}
                title={isVisible ? 'Ocultar capa' : 'Mostrar capa'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (l.id) onToggleVisible(l.id);
                }}
              />
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
                onDoubleClick={() => l.id && setEditingId(l.id)}
              >
                {editingId === l.id ? (
                  <input
                    type="text"
                    autoFocus
                    defaultValue={l.name ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      if (l.id) onRename(l.id, e.target.value || 'Capa');
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '3px 6px',
                      background: '#ffffff',
                      border: '1px solid #0078d4',
                      color: '#323130',
                      fontFamily:
                        'system-ui, -apple-system, "Segoe UI", sans-serif',
                      fontSize: '0.85rem',
                      outline: 'none',
                      borderRadius: 2,
                    }}
                  />
                ) : (
                  <>
                    <span
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 600 : 500,
                        color: isVisible ? '#323130' : '#a19f9d',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {l.name ?? '(sin nombre)'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: '#605e5c',
                      }}
                    >
                      {tileCount} tile{tileCount === 1 ? '' : 's'}
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <RowAction
                  icon="✎"
                  title="Renombrar"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (l.id) setEditingId(l.id);
                  }}
                />
                <RowAction
                  icon="↑"
                  title="Subir capa"
                  disabled={!canMoveUp}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (l.id) onMove(l.id, 1);
                  }}
                />
                <RowAction
                  icon="↓"
                  title="Bajar capa"
                  disabled={!canMoveDown}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (l.id) onMove(l.id, -1);
                  }}
                />
                <RowAction
                  icon="🗑"
                  title="Borrar capa"
                  danger
                  disabled={layers.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!l.id || layers.length <= 1) return;
                    setConfirmDelete({ id: l.id, name: l.name ?? 'capa' });
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <PixelConfirm
        open={confirmDelete !== null}
        title="Borrar capa"
        message={`¿Borrar "${confirmDelete?.name ?? 'capa'}"?`}
        confirmLabel="Sí, borrar"
        danger
        onConfirm={() => {
          if (confirmDelete) onDelete(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

// Compact icon action used inside layer rows (visibility / rename /
// move / delete). Same shape as the SceneManagerEditor version so
// the editor reads consistently.
function RowAction({
  icon,
  title,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: string;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26,
        height: 24,
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        background: !disabled && hover
          ? danger
            ? '#fde7e9'
            : '#f3f2f1'
          : '#ffffff',
        color: disabled
          ? '#a19f9d'
          : danger
            ? '#a4262c'
            : '#323130',
        border: '1px solid #d1d1d1',
        borderRadius: 2,
        fontSize: '0.85rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        lineHeight: 1,
      }}
    >
      {icon}
    </button>
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
        background: active ? '#0078d4' : '#ffffff',
        color: active ? '#ffffff' : '#323130',
        border: active ? '1px solid #0078d4' : '1px solid #d1d1d1',
        boxShadow: 'none',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: '0.72rem',
        letterSpacing: '0.1em',
        cursor: 'pointer',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </button>
  );
}

// Thin vertical divider between status-bar cells.
function StatusSep() {
  return (
    <div
      style={{
        width: 1,
        height: 12,
        background: 'rgba(255,255,255,0.4)',
      }}
    />
  );
}

// Zoom control buttons live on the (blue) status bar, so they style as
// translucent white chips to match the rest of that bar.
const zoomBtnStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.15)',
  color: '#ffffff',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 3,
  padding: '1px 7px',
  fontSize: '0.72rem',
  lineHeight: 1.4,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const zoomIconBtnStyle: CSSProperties = {
  ...zoomBtnStyle,
  padding: '0 6px',
  minWidth: 20,
  fontSize: '0.95rem',
  fontWeight: 700,
};

// Local helpers so the status-bar reads cleanly. `worldMapItems` is a
// no-op pass-through but lets the JSX type-narrow when items is null.
function worldMapItems(arr: unknown[] | null | undefined): unknown[] {
  return Array.isArray(arr) ? arr : [];
}

function modeLabel(m: string): string {
  switch (m) {
    case 'paint':
      return 'Pintar';
    case 'erase':
      return 'Borrar';
    case 'copy':
      return 'Copiar';
    case 'collision':
      return 'Colisión';
    case 'spawn':
      return 'Spawn';
    case 'light':
      return 'Luz';
    case 'transition':
      return 'Transición';
    case 'prop':
      return 'Prop';
    default:
      return m;
  }
}

// Quick Access Toolbar button — small (28×28) icon-only button used
// for save/undo/redo in the strip above the ribbon.
function QatButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        display: 'grid',
        placeItems: 'center',
        background:
          !disabled && hover ? '#f3f2f1' : 'transparent',
        border: 'none',
        borderRadius: 2,
        color: disabled ? '#a19f9d' : '#323130',
        fontSize: '0.92rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      {icon}
    </button>
  );
}

// A vertical group of ribbon buttons + a caption underneath. Mirrors
// the "group" pattern used in Office ribbons.
function RibbonGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        borderRight: '1px solid #edebe9',
        padding: '0 10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 4,
          flex: 1,
        }}
      >
        {children}
      </div>
      <div
        style={{
          fontSize: '0.7rem',
          color: '#605e5c',
          textAlign: 'center',
          marginTop: 4,
          paddingTop: 4,
          borderTop: '1px solid transparent',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        {label}
      </div>
    </div>
  );
}

// Big ribbon button — icon on top, label underneath. Used inside
// RibbonGroup. ~56×72 hit area, much easier to click than the old
// icon-only toolbar buttons.
function RibbonButton({
  icon,
  label,
  hotkey,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: string;
  label: string;
  hotkey?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={hotkey ? `${label} (${hotkey})` : label}
      style={{
        minWidth: 60,
        padding: '4px 6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        background: active
          ? '#deecf9'
          : !disabled && hover
            ? '#f3f2f1'
            : 'transparent',
        border: active
          ? '1px solid #0078d4'
          : '1px solid transparent',
        borderRadius: 2,
        color: disabled ? '#a19f9d' : '#323130',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ fontSize: '1.25rem', lineHeight: 1.1 }}>{icon}</span>
      <span
        style={{
          fontSize: '0.7rem',
          letterSpacing: '0.02em',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </button>
  );
}

function ToolbarLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '0.72rem',
        letterSpacing: '0.18em',
        color: 'rgba(50,49,48,0.6)',
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
        background: 'rgba(0,120,212,0.5)',
        margin: '0 4px',
      }}
    />
  );
}
