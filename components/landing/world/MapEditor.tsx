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
import {
  PanelHeader,
  SearchInput,
  SegmentedTabs,
  EditorButton,
  IconButton as GhostBtn,
  PANEL_WIDTH,
} from './editorUi';
import NpcEditor, { type NpcRecord } from './NpcEditor';
import { CharacterSprite, ANIMATIONS } from '../CharacterCreator';
import {
  IconAdd,
  IconEdit,
  IconUp,
  IconDown,
  IconDelete,
  IconEye,
  IconEyeOff,
  IconNpcs,
  IconLocation,
  IconClose,
  IconBrush,
  IconEraser,
  IconCopy,
  IconCollision,
  IconTarget,
  IconSpawn,
  IconCube,
  IconLight,
  IconTransition,
  IconSave,
  IconUndo,
  IconRedo,
} from './EditorIcons';
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
      // Preservar tiles de color sólido (centinela s/sx/sy = 0 + color). Sin
      // esto, al copiar un color se renderiza como sheet 0 (0,0) = otro sprite.
      if (t.color) cell.color = t.color;
      tiles.push(cell);
    }
  }
  // Capture order doesn't matter for dedup — the captured payload itself
  // is the identity.
  const sig = tiles
    .map(
      (c) => `${c.dx},${c.dy},${c.s},${c.sx},${c.sy},${c.c ?? 0},${c.color ?? ''}`,
    )
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
  playerTileX = 0,
  playerTileY = 0,
  onNpcsChanged,
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
  /** Posición del jugador (para colocar NPCs nuevos). */
  playerTileX?: number;
  playerTileY?: number;
  /** Mantiene vivos los NPCs en pantalla al editarlos en el juego. */
  onNpcsChanged?: (npcs: NpcRecord[]) => void;
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
    | 'prop'
    | 'npc';
  const [mode, setMode] = useState<EditorMode>('paint');

  // ── NPCs de esta escena ─────────────────────────────────────────────
  const [npcs, setNpcs] = useState<NpcRecord[]>([]);
  // Diálogo de creación/edición de NPC: 'new' (crear) | id (editar) | null.
  const [npcDialog, setNpcDialog] = useState<'new' | number | null>(null);
  // NPC seleccionado para ubicar por clic en el mapa (modo 'npc').
  const [placingNpcId, setPlacingNpcId] = useState<number | null>(null);
  // Frame animado para los sprites de NPC sobre el canvas.
  const [npcFrame, setNpcFrame] = useState(0);

  // ── Ventana flotante de paleta ("Pintar") ──────────────────────────
  // Abierta por defecto: el modo inicial es "Pintar", así que la paleta debe
  // verse al entrar. El botón "Pintar" la reabre si se cerró.
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [paletteMin, setPaletteMin] = useState(false);
  const [palettePos, setPalettePos] = useState({ x: 16, y: 70 });
  const paletteDragRef = useRef<{ dx: number; dy: number } | null>(null);
  const startPaletteDrag = (e: React.MouseEvent) => {
    paletteDragRef.current = {
      dx: e.clientX - palettePos.x,
      dy: e.clientY - palettePos.y,
    };
    const move = (ev: MouseEvent) => {
      if (!paletteDragRef.current) return;
      setPalettePos({
        x: Math.max(0, ev.clientX - paletteDragRef.current.dx),
        y: Math.max(0, ev.clientY - paletteDragRef.current.dy),
      });
    };
    const up = () => {
      paletteDragRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const refreshNpcs = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/world/npcs?scene=${encodeURIComponent(scene?.slug ?? 'main')}`,
      );
      const j = await r.json();
      const list = Array.isArray(j?.npcs) ? (j.npcs as NpcRecord[]) : [];
      setNpcs(list);
      onNpcsChanged?.(list);
    } catch {
      /* ignore */
    }
  }, [scene?.slug, onNpcsChanged]);

  useEffect(() => {
    refreshNpcs();
  }, [refreshNpcs]);

  useEffect(() => {
    const id = window.setInterval(() => setNpcFrame((f) => (f >= 8 ? 1 : f + 1)), 150);
    return () => window.clearInterval(id);
  }, []);
  const [brushHistory, setBrushHistory] = useState<Brush[]>([]);
  // Ribbon tab — like Word's tab strip (Inicio / Insertar / Diseño /
  // Vista). The active tab decides which group of commands renders
  // underneath the tab bar.
  const [ribbonTab, setRibbonTab] = useState<
    'inicio' | 'insertar' | 'npcs' | 'diseño' | 'vista'
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
  // Vista de la paleta: objetos / items (maestro-detalle por categoría) / hojas.
  const [tileView, setTileView] = useState<'objects' | 'items' | 'sheets'>(
    'objects',
  );
  // Categoría seleccionada en la vista Objetos (maestro). Su contenido se
  // muestra a la derecha. Vacío = se autoselecciona la primera disponible.
  const [selectedSection, setSelectedSection] = useState<string>('obj:veg');
  const allSprites = useAllSprites(tileView === 'objects');
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
  // Hay cambios sin guardar si el historial avanzó desde el último guardado.
  useEffect(() => {
    setDirty(historyIdx !== savedHistoryRef.current);
  }, [historyIdx]);
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
  // Punto del historial en el último guardado → detecta cambios sin guardar.
  const savedHistoryRef = useRef(0);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  // Cierra el editor; si hay cambios sin guardar, pide confirmación.
  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else onClose();
  };

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
    // Al elegir un sprite/objeto se descartan las otras selecciones (item,
    // prop, color) para que la pintura use esta brocha.
    setItemBrush(null);
    setPropBrushItemId(null);
    setColorBrushHex(null);
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

    if (mode === 'npc') {
      // Colocar el NPC seleccionado en la celda clicada (guarda y refresca).
      if (placingNpcId == null) return;
      const id = placingNpcId;
      const npc = npcs.find((n) => n.id === id);
      if (npc) {
        fetch(`/api/world/npcs/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scene: scene?.slug ?? 'main',
            name: npc.name,
            config: npc.config,
            x: cx,
            y: cy,
            facing: npc.facing,
            animation: npc.animation,
            dialogue: npc.dialogue,
          }),
        })
          .then(() => refreshNpcs())
          .catch(() => undefined);
      }
      setPlacingNpcId(null);
      setMode('paint');
      return;
    }
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
    if (itemBrush) {
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
      savedHistoryRef.current = historyIdx;
      setDirty(false);
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
        gridTemplateColumns: '1fr 220px',
        animation: embedded ? undefined : 'pixelFadeIn 0.4s ease-out',
      }}
    >
      {/* ── Paleta flotante (la abre "Pintar"): movible y minimizable ── */}
      <aside
        style={{
          position: 'absolute',
          left: palettePos.x,
          top: palettePos.y,
          zIndex: 40,
          width: 420,
          height: paletteMin ? 'auto' : 'min(80vh, 640px)',
          display: paletteOpen ? 'flex' : 'none',
          flexDirection: 'column',
          background: '#ffffff',
          border: '1px solid #c8c6c4',
          borderRadius: 8,
          boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
          overflow: 'hidden',
        }}
      >
        {/* Barra de título (arrastrar / minimizar / cerrar) */}
        <div
          onMouseDown={startPaletteDrag}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 8px 7px 12px',
            background: '#f3f2f1',
            borderBottom: paletteMin ? 'none' : '1px solid #edebe9',
            cursor: 'move',
            userSelect: 'none',
          }}
        >
          <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600, color: '#323130' }}>
            Paleta · Pintar
          </span>
          <button
            type="button"
            onClick={() => setPaletteMin((v) => !v)}
            title={paletteMin ? 'Expandir' : 'Minimizar'}
            style={paletteTitleBtn}
          >
            {paletteMin ? '▢' : '—'}
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(false)}
            title="Cerrar paleta"
            style={paletteTitleBtn}
          >
            ✕
          </button>
        </div>

        {!paletteMin && (
        <PanelHeader title="Editor del mundo">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar (sheet, categoría)…"
          />
        </PanelHeader>
        )}
        {!paletteMin && (
        <>
        <div style={{ padding: '8px 10px 6px' }}>
          <SegmentedTabs
            value={tileView}
            onChange={(v) => {
              setTileView(v);
              if (v === 'objects' || v === 'items') setMode('paint');
            }}
            tabs={[
              { value: 'objects', label: 'Objetos' },
              { value: 'items', label: 'Items' },
              { value: 'sheets', label: 'Hojas' },
            ]}
          />
        </div>

        {tileView === 'sheets' && (
          <div
            style={{
              padding: 10,
              borderBottom: '1px solid #edebe9',
            }}
          >
            {(
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
                  fontFamily:
                    "system-ui, -apple-system, 'Segoe UI', sans-serif",
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
            )}
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
          {(tileView === 'objects' || tileView === 'items') && (
            tileView === 'objects' && allSprites === null ? (
              <div
                style={{
                  fontSize: '0.78rem',
                  color: '#605e5c',
                  padding: '12px 4px',
                  textAlign: 'center',
                }}
              >
                Analizando sprites…
              </div>
            ) : (() => {
              const matchQ = (it: (typeof ITEMS)[number]) =>
                !filteredQuery ||
                it.label.toLowerCase().includes(filteredQuery) ||
                it.id.toLowerCase().includes(filteredQuery);
              const objSecs = allSprites
                ? SPRITE_CATEGORIES.filter((c) => c.id !== 'all')
                    .map((c) => ({
                      key: `obj:${c.id}`,
                      label: c.label,
                      count: allSprites.list.filter((s) => s.cat === c.id)
                        .length,
                    }))
                    .filter((s) => s.count > 0)
                : [];
              const itemSecs = ITEM_CATEGORIES.map((c) => ({
                key: `item:${c.id}`,
                label: c.label,
                count: ITEMS.filter((it) => it.category === c.id && matchQ(it))
                  .length,
              })).filter((s) => s.count > 0);
              const propSecs = ITEM_CATEGORIES.map((c) => ({
                key: `prop:${c.id}`,
                label: c.label,
                count: ITEMS.filter((it) => it.category === c.id && matchQ(it))
                  .length,
              })).filter((s) => s.count > 0);
              const groups: {
                title: string;
                secs: { key: string; label: string; count?: number }[];
              }[] =
                tileView === 'items'
                  ? [{ title: '', secs: itemSecs }]
                  : [
                      { title: 'Objetos', secs: objSecs },
                      { title: 'Props', secs: propSecs },
                      {
                        title: '',
                        secs: [{ key: 'cat:colors', label: 'Colores' }],
                      },
                    ];
              const allKeys = groups.flatMap((g) => g.secs.map((s) => s.key));
              const sel = allKeys.includes(selectedSection)
                ? selectedSection
                : allKeys[0];

              return (
                <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
                  {/* Maestro: lista compacta de categorías */}
                  <div
                    style={{
                      width: 132,
                      flexShrink: 0,
                      overflowY: 'auto',
                      borderRight: '1px solid #edebe9',
                      paddingRight: 4,
                    }}
                  >
                    {groups.map((g) => (
                      <div key={g.title || 'colors'}>
                        {g.title && (
                          <div
                            style={{
                              fontSize: '0.58rem',
                              fontWeight: 700,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: '#a19f9d',
                              padding: '7px 7px 2px',
                            }}
                          >
                            {g.title}
                          </div>
                        )}
                        {g.secs.map((s) => (
                          <CategoryRow
                            key={s.key}
                            label={s.label}
                            count={s.count}
                            active={sel === s.key}
                            onClick={() => setSelectedSection(s.key)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Detalle: ítems de la categoría seleccionada */}
                  <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
                    {sel === 'cat:colors' ? (
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
                    ) : sel.startsWith('obj:') ? (
                      (() => {
                        const catId = sel.slice(4);
                        const items = (allSprites?.list ?? []).filter(
                          (s) => s.cat === catId,
                        );
                        const CAP = 400;
                        return (
                          <>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                  'repeat(auto-fill, minmax(60px, 1fr))',
                                gap: 6,
                              }}
                            >
                              {items.slice(0, CAP).map((sp, i) => {
                                const isActive =
                                  brush?.source === 'sheet' &&
                                  brush.sheetIdx === sp.sheetIdx &&
                                  brush.sx === sp.sx &&
                                  brush.sy === sp.sy;
                                return (
                                  <SpriteThumb
                                    key={`${sp.sheetIdx}:${sp.sx}:${sp.sy}:${i}`}
                                    sprite={sp}
                                    active={!!isActive}
                                    onClick={() =>
                                      activateBrush(
                                        sheetBrush(
                                          sp.sheetIdx,
                                          sp.sx,
                                          sp.sy,
                                          sp.w,
                                          sp.h,
                                        ),
                                      )
                                    }
                                  />
                                );
                              })}
                            </div>
                            {items.length > CAP && (
                              <div
                                style={{
                                  fontSize: '0.7rem',
                                  color: '#a19f9d',
                                  textAlign: 'center',
                                  padding: '8px 4px',
                                }}
                              >
                                Mostrando {CAP} de {items.length}.
                              </div>
                            )}
                          </>
                        );
                      })()
                    ) : (
                      (() => {
                        const isProp = sel.startsWith('prop:');
                        const catId = sel.slice(5);
                        const list = ITEMS.filter(
                          (it) => it.category === catId && matchQ(it),
                        );
                        return (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns:
                                'repeat(auto-fill, minmax(56px, 1fr))',
                              gap: 6,
                            }}
                          >
                            {list.map((it) => {
                              const active = isProp
                                ? propBrushItemId === it.id
                                : itemBrush === it.id;
                              return (
                                <button
                                  key={it.id}
                                  type="button"
                                  title={it.label}
                                  style={paletteCellStyle(active)}
                                  onClick={() => {
                                    if (isProp) {
                                      setPropBrushItemId(it.id);
                                      setBrush(null);
                                      setItemBrush(null);
                                      setColorBrushHex(null);
                                      setMode('prop');
                                    } else {
                                      setItemBrush(it.id);
                                      setBrush(null);
                                      setPropBrushItemId(null);
                                      setColorBrushHex(null);
                                      setMode('paint');
                                    }
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
                                      objectFit: 'contain',
                                    }}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              );
            })()
          )}
          {tileView === 'sheets' && (
            <div
              style={{
                fontSize: '0.72rem',
                color: '#605e5c',
                lineHeight: 1.5,
                padding: '0 2px 4px',
              }}
            >
              <strong style={{ color: '#323130' }}>Tip:</strong> pasa el cursor
              y haz <strong style={{ color: '#0078d4' }}>clic</strong> para
              seleccionar el sprite completo (se resalta en azul). O{' '}
              <strong>arrastra</strong> para elegir un rango de celdas a mano.
              Luego clic en el mapa para estamparlo.
            </div>
          )}
          {tileView === 'sheets' &&
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
        </>
        )}
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
            icon={<IconSave size={18} />}
            label={saving ? 'Guardando…' : 'Guardar (⌘S)'}
            onClick={save}
            disabled={saving}
          />
          <QatButton
            icon={<IconUndo size={18} />}
            label="Deshacer (⌘Z)"
            onClick={undo}
            disabled={historyIdx <= 0}
          />
          <QatButton
            icon={<IconRedo size={18} />}
            label="Rehacer (⌘⇧Z)"
            onClick={redo}
            disabled={historyIdx >= history.length - 1}
          />
          {brush && mode === 'paint' && (
            <BrushPreview brush={brush} imgs={imgs} />
          )}
          <div style={{ flex: 1 }} />
          {/* Estado de guardado: cambios pendientes / última fecha */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.76rem',
              color: dirty ? '#a4660a' : '#107c10',
              letterSpacing: '0.02em',
              marginRight: 4,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: dirty ? '#d29200' : '#107c10',
              }}
            />
            {dirty
              ? 'Cambios sin guardar'
              : savedAt
                ? `Guardado ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Sin cambios'}
          </span>
          <QatButton
            icon={<IconClose size={18} />}
            label="Cerrar editor"
            onClick={requestClose}
          />
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
              { id: 'npcs', label: 'NPCs' },
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
                  icon={<IconBrush size={20} />}
                  label="Pintar"
                  hotkey="Q"
                  active={mode === 'paint'}
                  onClick={() => {
                    setMode('paint');
                    setPaletteOpen(true);
                    setPaletteMin(false);
                  }}
                />
                <RibbonButton
                  icon={<IconEraser size={20} />}
                  label="Borrar"
                  hotkey="W"
                  active={mode === 'erase'}
                  onClick={() => setMode('erase')}
                />
                <RibbonButton
                  icon={<IconCopy size={20} />}
                  label="Copiar"
                  hotkey="E"
                  active={mode === 'copy'}
                  onClick={() => setMode('copy')}
                />
              </RibbonGroup>
              <RibbonGroup label="Tile">
                <RibbonButton
                  icon={<IconCollision size={20} />}
                  label="Colisión"
                  hotkey="R"
                  active={mode === 'collision'}
                  onClick={() => setMode('collision')}
                />
                <RibbonButton
                  icon={<IconTarget size={20} />}
                  label="Ver colisiones"
                  hotkey="T"
                  active={showCollisions}
                  onClick={() => setShowCollisions((v) => !v)}
                />
              </RibbonGroup>
              <RibbonGroup label="Spawn">
                <RibbonButton
                  icon={<IconSpawn size={20} />}
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
                  icon={<IconCube size={20} />}
                  label="Prop"
                  hotkey="P"
                  active={mode === 'prop'}
                  onClick={() => setMode('prop')}
                />
              </RibbonGroup>
              <RibbonGroup label="Especiales">
                <RibbonButton
                  icon={<IconLight size={20} />}
                  label="Luz"
                  hotkey="L"
                  active={mode === 'light'}
                  onClick={() => setMode('light')}
                />
                <RibbonButton
                  icon={<IconTransition size={20} />}
                  label="Transición"
                  hotkey=""
                  active={mode === 'transition'}
                  onClick={() => setMode('transition')}
                />
              </RibbonGroup>
            </>
          )}
          {ribbonTab === 'npcs' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 10,
                width: '100%',
                height: 80,
                overflowX: 'auto',
                overflowY: 'hidden',
                padding: '2px 4px',
              }}
            >
              {/* Crear nuevo NPC — botón grande */}
              <button
                type="button"
                onClick={() => setNpcDialog('new')}
                style={{
                  flexShrink: 0,
                  width: 120,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  background: '#f3f9fd',
                  border: '1px dashed #0078d4',
                  borderRadius: 6,
                  color: '#0078d4',
                  cursor: 'pointer',
                  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                <IconAdd size={22} />
                Crear nuevo NPC
              </button>

              {npcs.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: '#a19f9d',
                    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
                    fontSize: '0.8rem',
                    padding: '0 12px',
                  }}
                >
                  Aún no hay NPCs en esta escena.
                </div>
              ) : (
                npcs.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      flexShrink: 0,
                      width: 110,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 6px',
                      background: '#ffffff',
                      border:
                        placingNpcId === n.id
                          ? '1px solid #0078d4'
                          : '1px solid #d1d1d1',
                      borderRadius: 6,
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 44,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <CharacterSprite
                        config={n.config}
                        direction={n.facing}
                        animation={n.animation}
                        frame={npcFrame}
                        scale={0.55}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 4,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#323130',
                        fontFamily:
                          'system-ui, -apple-system, "Segoe UI", sans-serif',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}
                    >
                      {n.name}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setNpcDialog(n.id)}
                        title="Editar NPC"
                        style={npcCardBtn(false)}
                      >
                        <IconEdit size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPlacingNpcId(n.id);
                          setMode('npc');
                        }}
                        title="Ubicar en el mapa (clic en una celda)"
                        style={npcCardBtn(placingNpcId === n.id)}
                      >
                        <IconLocation size={13} />
                      </button>
                    </div>
                    </div>
                  </div>
                ))
              )}
            </div>
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
                  icon={<IconTarget size={20} />}
                  label="Mostrar colisiones"
                  hotkey="T"
                  active={showCollisions}
                  onClick={() => setShowCollisions((v) => !v)}
                />
              </RibbonGroup>
              <RibbonGroup label="Iluminación">
                <div style={{ position: 'relative' }}>
                  <RibbonButton
                    icon={<IconLight size={20} />}
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
                if (mode === 'light' || mode === 'transition' || mode === 'npc') {
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
              mode={mode === 'npc' ? 'spawn' : mode}
              hoverCell={hoverCell}
              copyDrag={copyDrag}
              imgs={imgs}
              width={width}
              height={height}
            />

            {/* NPCs colocados — overlays DOM (no canvas), escalan con el zoom. */}
            {npcs.map((n) => (
              <div
                key={n.id}
                onClick={(e) => {
                  // En modo colocar, el clic lo maneja el canvas; aquí dejamos pasar.
                  if (mode === 'npc') return;
                  e.stopPropagation();
                  setNpcDialog(n.id);
                }}
                title={`${n.name} (${n.x},${n.y}) — clic para editar`}
                style={{
                  position: 'absolute',
                  left: (n.x + 0.5) * TILE_PX * viewScale,
                  top: (n.y + 0.5) * TILE_PX * viewScale,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: mode === 'npc' ? 'none' : 'auto',
                  cursor: 'pointer',
                  zIndex: 6,
                  opacity: placingNpcId === n.id ? 0.4 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <CharacterSprite
                  config={n.config}
                  direction={n.facing}
                  animation={n.animation}
                  frame={npcFrame}
                  scale={Math.max(0.5, viewScale)}
                />
                <span
                  style={{
                    marginTop: -2 * viewScale,
                    padding: '1px 5px',
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    borderRadius: 4,
                    fontSize: Math.max(8, 5 * viewScale),
                    fontFamily: 'system-ui, sans-serif',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}
                >
                  {n.name}
                </span>
              </div>
            ))}
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

      {/* Aviso de modo "Ubicar NPC" */}
      {mode === 'npc' && placingNpcId != null && (
        <div
          style={{
            position: 'absolute',
            top: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: '#0078d4',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          Haz clic en una celda del mapa para ubicar el NPC.
          <button
            type="button"
            onClick={() => {
              setPlacingNpcId(null);
              setMode('paint');
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.5)',
              color: '#fff',
              borderRadius: 4,
              padding: '3px 10px',
              cursor: 'pointer',
              fontSize: '0.78rem',
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Confirmación de cierre con cambios sin guardar */}
      <PixelConfirm
        open={confirmClose}
        title="Cambios sin guardar"
        message="Tienes cambios sin guardar en el mapa. ¿Salir sin guardarlos?"
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        danger
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
        onCancel={() => setConfirmClose(false)}
      />

      {/* Diálogo de crear / editar NPC */}
      {npcDialog !== null && (
        <NpcEditor
          sceneSlug={sceneSlug}
          playerTileX={playerTileX}
          playerTileY={playerTileY}
          initialNpcId={npcDialog}
          onChanged={(list) => {
            setNpcs(list);
            onNpcsChanged?.(list);
          }}
          onClose={() => {
            setNpcDialog(null);
            refreshNpcs();
          }}
        />
      )}
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
// Fila compacta de categoría (maestro): la seleccionada se marca con relleno de
// fondo + barra azul a la izquierda. A la derecha se muestran sus ítems.
function CategoryRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        padding: '4px 7px',
        marginBottom: 2,
        background: active ? '#deecf9' : hover ? '#f3f2f1' : 'transparent',
        borderLeft: `3px solid ${active ? '#0078d4' : 'transparent'}`,
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        borderRadius: 3,
        cursor: 'pointer',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: '0.72rem',
          fontWeight: 600,
          color: active ? '#0078d4' : '#323130',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
      {count != null && (
        <span
          style={{
            fontSize: '0.62rem',
            color: active ? '#0078d4' : '#a19f9d',
            fontWeight: 600,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

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

// ¿La celda (cx,cy) del sheet tiene contenido (no es solo fondo blanco/transparente)?
function cellHasContent(
  data: Uint8ClampedArray,
  imgW: number,
  cx: number,
  cy: number,
  cellW: number,
  cellH: number,
): boolean {
  const x0 = Math.floor(cx * cellW);
  const y0 = Math.floor(cy * cellH);
  const w = Math.max(1, Math.floor(cellW));
  const h = Math.max(1, Math.floor(cellH));
  const step = Math.max(1, Math.floor(Math.min(w, h) / 8));
  let count = 0;
  for (let y = 1; y < h; y += step) {
    for (let x = 1; x < w; x += step) {
      const i = ((y0 + y) * imgW + (x0 + x)) * 4;
      const a = data[i + 3];
      if (a < 24) continue; // transparente = fondo
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 240 && g > 240 && b > 240) continue; // casi blanco = fondo
      if (++count >= 3) return true;
    }
  }
  return false;
}

// Categorías de sprites (clasificación automática por color dominante).
type SpriteCat = 'veg' | 'water' | 'stone' | 'wood' | 'light' | 'other';
const SPRITE_CATEGORIES: { id: SpriteCat | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'veg', label: 'Vegetación' },
  { id: 'water', label: 'Agua' },
  { id: 'stone', label: 'Piedra' },
  { id: 'wood', label: 'Tierra/Madera' },
  { id: 'light', label: 'Claro' },
  { id: 'other', label: 'Otros' },
];

type SpriteBox = { sx: number; sy: number; w: number; h: number };
type DetectedSprite = SpriteBox & { sheetIdx: number; cat: SpriteCat };

// Clasifica un píxel por su color (HSV) en una categoría.
function classifyPixel(r: number, g: number, b: number): SpriteCat {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  if (s < 0.18) return v > 0.8 ? 'light' : 'stone'; // gris claro / oscuro
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  if (h >= 65 && h < 175) return 'veg'; // verde
  if (h >= 175 && h < 265) return 'water'; // cian/azul
  if (h >= 20 && h < 65) return 'wood'; // amarillo/naranja/marrón
  return 'other';
}

// Categoría dominante de un sprite (voto mayoritario de píxeles no-fondo).
function classifySprite(
  data: Uint8ClampedArray,
  imgW: number,
  box: SpriteBox,
  cellW: number,
  cellH: number,
): SpriteCat {
  const tally: Record<SpriteCat, number> = {
    veg: 0,
    water: 0,
    stone: 0,
    wood: 0,
    light: 0,
    other: 0,
  };
  const x0 = Math.floor(box.sx * cellW);
  const y0 = Math.floor(box.sy * cellH);
  const x1 = Math.floor((box.sx + box.w) * cellW);
  const y1 = Math.floor((box.sy + box.h) * cellH);
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * imgW + x) * 4;
      const a = data[i + 3];
      if (a < 24) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 240 && g > 240 && b > 240) continue; // fondo blanco
      tally[classifyPixel(r, g, b)]++;
    }
  }
  let best: SpriteCat = 'other';
  let bestN = -1;
  (Object.keys(tally) as SpriteCat[]).forEach((k) => {
    if (tally[k] > bestN) {
      bestN = tally[k];
      best = k;
    }
  });
  return best;
}

// Firma visual de un sprite: RGB promedio sobre una rejilla 3×3 (27 números).
// Sirve para deduplicar frames de animación (muy parecidos entre sí).
function spriteSignature(
  data: Uint8ClampedArray,
  imgW: number,
  box: SpriteBox,
  cellW: number,
  cellH: number,
): number[] {
  const x0 = box.sx * cellW;
  const y0 = box.sy * cellH;
  const bw = (box.w * cellW) / 3;
  const bh = (box.h * cellH) / 3;
  const sig: number[] = [];
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      let r = 0, g = 0, b = 0, n = 0;
      const rx = x0 + gx * bw;
      const ry = y0 + gy * bh;
      for (let y = ry; y < ry + bh; y += 3) {
        for (let x = rx; x < rx + bw; x += 3) {
          const i = ((y | 0) * imgW + (x | 0)) * 4;
          if (data[i + 3] < 24) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
      }
      sig.push(n ? r / n : 0, n ? g / n : 0, n ? b / n : 0);
    }
  }
  return sig;
}

// Distancia normalizada (0..1) entre dos firmas.
function sigDistance(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / (a.length * 255);
}

// ¿El píxel `i` es contenido (no fondo transparente ni casi blanco)?
function isContentPixel(data: Uint8ClampedArray, i: number): boolean {
  const a = data[i + 3];
  if (a < 32) return false;
  if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) return false;
  return true;
}

// Detección de OBJETOS por PÍXEL (no por celda): en los sheets los objetos están
// pegados a nivel de celda, pero separados por píxeles de fondo. El flood-fill a
// nivel de píxel sí los separa. Devuelve recuadros AJUSTADOS a celdas. Usa
// downsample (DS) para que sea rápido en el navegador.
function detectObjectsPixel(
  data: Uint8ClampedArray,
  W: number,
  H: number,
  cols: number,
  rows: number,
): SpriteBox[] {
  const DS = 2;
  const w2 = Math.ceil(W / DS);
  const h2 = Math.ceil(H / DS);
  const mask = new Uint8Array(w2 * h2);
  for (let y = 0; y < h2; y++)
    for (let x = 0; x < w2; x++)
      mask[y * w2 + x] = isContentPixel(data, (y * DS * W + x * DS) * 4) ? 1 : 0;

  const seen = new Uint8Array(w2 * h2);
  const stack = new Int32Array(w2 * h2);
  const cw = W / cols;
  const ch = H / rows;
  const boxes: SpriteBox[] = [];
  const fullArea = W * H;
  for (let p0 = 0; p0 < w2 * h2; p0++) {
    if (!mask[p0] || seen[p0]) continue;
    let sp = 0;
    stack[sp++] = p0;
    seen[p0] = 1;
    let minX = w2, minY = h2, maxX = 0, maxY = 0, n = 0;
    while (sp > 0) {
      const p = stack[--sp];
      n++;
      const x = p % w2;
      const y = (p / w2) | 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w2 || ny >= h2) continue;
          const np = ny * w2 + nx;
          if (mask[np] && !seen[np]) {
            seen[np] = 1;
            stack[sp++] = np;
          }
        }
    }
    const pxW = (maxX - minX + 1) * DS;
    const pxH = (maxY - minY + 1) * DS;
    const area = n * DS * DS;
    if (area < 100 || pxW < 8 || pxH < 8) continue; // ruido / slivers
    if (area > fullArea * 0.35) continue; // bloque de terreno
    const sx = Math.floor((minX * DS) / cw);
    const sy = Math.floor((minY * DS) / ch);
    const ex = Math.ceil(((maxX + 1) * DS) / cw);
    const ey = Math.ceil(((maxY + 1) * DS) / ch);
    const box: SpriteBox = {
      sx,
      sy,
      w: Math.max(1, ex - sx),
      h: Math.max(1, ey - sy),
    };
    if (box.w > 14 || box.h > 14) continue;
    boxes.push(box);
  }
  return boxes;
}

// Fracción del recuadro que es contenido (no fondo). Un tile de terreno llena
// la celda casi por completo (≈1); un objeto deja márgenes de fondo (<0.9).
function contentDensity(
  data: Uint8ClampedArray,
  imgW: number,
  box: SpriteBox,
  cellW: number,
  cellH: number,
): number {
  const x0 = Math.floor(box.sx * cellW);
  const y0 = Math.floor(box.sy * cellH);
  const x1 = Math.floor((box.sx + box.w) * cellW);
  const y1 = Math.floor((box.sy + box.h) * cellH);
  let content = 0;
  let total = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      total++;
      const i = (y * imgW + x) * 4;
      const a = data[i + 3];
      if (a < 24) continue;
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) continue;
      content++;
    }
  }
  return total ? content / total : 0;
}

// Detección pura: componentes conectados (8-vec) de celdas con contenido,
// limitados a 8×8 (los más grandes son terreno empacado, no objetos).
const SPRITE_MAX_CELLS = 8;
function detectSpriteComponents(
  data: Uint8ClampedArray,
  imgW: number,
  cols: number,
  rows: number,
  cellW: number,
  cellH: number,
): { box: SpriteBox; cells: [number, number][] }[] {
  const occ: boolean[] = new Array(cols * rows);
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++)
      occ[cy * cols + cx] = cellHasContent(data, imgW, cx, cy, cellW, cellH);
  const seen = new Array(cols * rows).fill(false);
  const out: { box: SpriteBox; cells: [number, number][] }[] = [];
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const idx = cy * cols + cx;
      if (!occ[idx] || seen[idx]) continue;
      const stack: [number, number][] = [[cx, cy]];
      const cells: [number, number][] = [];
      seen[idx] = true;
      let minX = cx, minY = cy, maxX = cx, maxY = cy;
      while (stack.length) {
        const [x, y] = stack.pop()!;
        cells.push([x, y]);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const ni = ny * cols + nx;
            if (occ[ni] && !seen[ni]) {
              seen[ni] = true;
              stack.push([nx, ny]);
            }
          }
      }
      const box: SpriteBox = {
        sx: minX,
        sy: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
      };
      out.push({ box, cells });
    }
  }
  return out;
}

// ¿El componente es un OBJETO (recuadro pequeño) o terreno empacado (grande)?
function isObjectBox(box: SpriteBox): boolean {
  return box.w <= SPRITE_MAX_CELLS && box.h <= SPRITE_MAX_CELLS;
}

// Carga un sheet y devuelve sus píxeles (o null si CORS/tainted).
function loadSheetPixels(
  sheet: (typeof SHEETS)[number],
): Promise<{
  data: Uint8ClampedArray;
  w: number;
  h: number;
  cellW: number;
  cellH: number;
} | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Same-origin (/tiles/*): NO usamos crossOrigin para evitar un canvas
    // "tainted" si el navegador cacheó la imagen en modo no-CORS.
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        // Dibuja a la resolución natural y deriva el tamaño de celda real.
        const natW = img.naturalWidth || sheet.cols * TILE_PX;
        const natH = img.naturalHeight || sheet.rows * TILE_PX;
        cv.width = natW;
        cv.height = natH;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve({
          data: ctx.getImageData(0, 0, natW, natH).data,
          w: natW,
          h: natH,
          cellW: natW / sheet.cols,
          cellH: natH / sheet.rows,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = sheet.url;
  });
}

// Mapa celda→recuadro del sprite, para el SheetPalette (clic = sprite).
function useSheetSprites(sheet: (typeof SHEETS)[number]) {
  const [map, setMap] = useState<Map<string, SpriteBox>>(new Map());
  useEffect(() => {
    let cancelled = false;
    loadSheetPixels(sheet).then((px) => {
      if (cancelled || !px) return;
      const comps = detectSpriteComponents(
        px.data,
        px.w,
        sheet.cols,
        sheet.rows,
        px.cellW,
        px.cellH,
      );
      const result = new Map<string, SpriteBox>();
      // Solo los objetos pequeños mapean su recuadro; el terreno empacado se
      // selecciona celda a celda (fallback 1×1 en el SheetPalette).
      for (const c of comps)
        if (isObjectBox(c.box))
          for (const [x, y] of c.cells) result.set(`${x},${y}`, c.box);
      setMap(result);
    });
    return () => {
      cancelled = true;
    };
  }, [sheet.url, sheet.cols, sheet.rows]);
  return map;
}

// Detecta y clasifica TODOS los sprites de TODOS los sheets (una vez, al activar
// la galería). Devuelve la lista plana + estado de carga.
function useAllSprites(active: boolean) {
  const [sprites, setSprites] = useState<{
    list: DetectedSprite[];
    loaded: number;
  } | null>(null);
  useEffect(() => {
    if (!active || sprites) return;
    let cancelled = false;
    (async () => {
      const all: DetectedSprite[] = [];
      const results = await Promise.all(SHEETS.map((s) => loadSheetPixels(s)));
      let loaded = 0;
      results.forEach((px, sheetIdx) => {
        if (!px) return;
        loaded++;
        const sheet = SHEETS[sheetIdx];
        // Detección por PÍXEL (separa objetos pegados a nivel de celda).
        const boxes = detectObjectsPixel(
          px.data,
          px.w,
          px.h,
          sheet.cols,
          sheet.rows,
        );
        // Sprites (con firma) por sheet, para deduplicar frames de animación.
        const perSheet: { sprite: DetectedSprite; sig: number[] }[] = [];
        for (const box of boxes) {
          const sprite: DetectedSprite = {
            ...box,
            sheetIdx,
            cat: classifySprite(px.data, px.w, box, px.cellW, px.cellH),
          };
          const sig = spriteSignature(px.data, px.w, box, px.cellW, px.cellH);
          // Dedup: mismo tamaño + firma muy parecida ⇒ otro frame del mismo
          // objeto → no se agrega de nuevo.
          const dup = perSheet.some(
            (p) =>
              p.sprite.w === sprite.w &&
              p.sprite.h === sprite.h &&
              sigDistance(p.sig, sig) < 0.07,
          );
          if (!dup) perSheet.push({ sprite, sig });
        }
        for (const p of perSheet) all.push(p.sprite);
      });
      if (!cancelled) setSprites({ list: all, loaded });
    })();
    return () => {
      cancelled = true;
    };
  }, [active, sprites]);
  return sprites;
}

// Miniatura de un sprite recortado de su sheet (para la galería por categoría).
function SpriteThumb({
  sprite,
  active,
  onClick,
}: {
  sprite: DetectedSprite;
  active: boolean;
  onClick: () => void;
}) {
  const sheet = SHEETS[sprite.sheetIdx];
  const BOX = 60;
  const scale = BOX / (Math.max(sprite.w, sprite.h) * TILE_PX);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${sheet.name} · ${sprite.w}×${sprite.h}`}
      style={paletteCellStyle(active)}
    >
      <div
        style={{
          width: sprite.w * TILE_PX * scale,
          height: sprite.h * TILE_PX * scale,
          backgroundImage: `url(${sheet.url})`,
          backgroundSize: `${sheet.cols * TILE_PX * scale}px ${sheet.rows * TILE_PX * scale}px`,
          backgroundPosition: `-${sprite.sx * TILE_PX * scale}px -${sprite.sy * TILE_PX * scale}px`,
          imageRendering: 'pixelated',
        }}
      />
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
  // Sprites detectados (recuadro por celda) + celda bajo el cursor.
  const sprites = useSheetSprites(sheet);
  const [hover, setHover] = useState<{ sx: number; sy: number } | null>(null);
  const draggedRef = useRef(false);

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
        draggedRef.current = false;
        setDragStart(c);
        setDragNow(c);
      }}
      onMouseMove={(e) => {
        const c = cellAt(e, e.currentTarget as HTMLDivElement);
        setHover(c);
        if (!dragStart || !c) return;
        if (c.sx !== dragStart.sx || c.sy !== dragStart.sy) draggedRef.current = true;
        setDragNow(c);
      }}
      onMouseUp={() => {
        if (!dragStart || !dragNow) {
          setDragStart(null);
          setDragNow(null);
          return;
        }
        if (!draggedRef.current) {
          // Clic simple → selecciona el SPRITE completo (recuadro detectado), o
          // la celda si no se detectó sprite.
          const bbox = sprites.get(`${dragNow.sx},${dragNow.sy}`);
          if (bbox) onPick(sheetBrush(sheetIdx, bbox.sx, bbox.sy, bbox.w, bbox.h));
          else onPick(sheetBrush(sheetIdx, dragNow.sx, dragNow.sy, 1, 1));
        } else {
          const sx = Math.min(dragStart.sx, dragNow.sx);
          const sy = Math.min(dragStart.sy, dragNow.sy);
          const w = Math.abs(dragNow.sx - dragStart.sx) + 1;
          const h = Math.abs(dragNow.sy - dragStart.sy) + 1;
          onPick(sheetBrush(sheetIdx, sx, sy, w, h));
        }
        setDragStart(null);
        setDragNow(null);
      }}
      onMouseLeave={() => {
        setHover(null);
        if (dragStart && dragNow && draggedRef.current) {
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
      {/* Resalte bajo el cursor: el SPRITE detectado, o 1 celda si es terreno. */}
      {!dragStart && hover && (() => {
        const b = sprites.get(`${hover.sx},${hover.sy}`) ?? {
          sx: hover.sx,
          sy: hover.sy,
          w: 1,
          h: 1,
        };
        return (
          <div
            style={{
              position: 'absolute',
              left: b.sx * PALETTE_TILE,
              top: b.sy * PALETTE_TILE,
              width: b.w * PALETTE_TILE,
              height: b.h * PALETTE_TILE,
              border: '2px solid #0078d4',
              background: 'rgba(0,120,212,0.12)',
              pointerEvents: 'none',
            }}
          />
        );
      })()}
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
      <PanelHeader
        title="Capas"
        actions={
          <EditorButton
            icon={<IconAdd size={14} />}
            onClick={onAdd}
            title="Agregar capa nueva (vacía, encima de las demás)"
          >
            Nueva
          </EditorButton>
        }
      >
        <span style={{ fontSize: '0.72rem', color: '#605e5c' }}>
          {reversed.length} capa{reversed.length === 1 ? '' : 's'}
        </span>
      </PanelHeader>
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
          const editing = editingId === l.id;
          return (
            <div
              key={l.id}
              onClick={() => !editing && l.id && onActivate(l.id)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '9px 10px 9px 12px',
                margin: '1px 0',
                background: isActive ? '#deecf9' : 'transparent',
                borderLeft: isActive
                  ? '3px solid #0078d4'
                  : '3px solid transparent',
                cursor: editing ? 'default' : 'pointer',
              }}
            >
              {editing ? (
                /* ── Formulario de edición de la capa ── */
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <label
                    style={{
                      fontSize: '0.62rem',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#0078d4',
                      fontWeight: 600,
                    }}
                  >
                    Nombre de la capa
                  </label>
                  <input
                    type="text"
                    autoFocus
                    defaultValue={l.name ?? ''}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = (e.target as HTMLInputElement).value;
                        if (l.id) onRename(l.id, v || 'Capa');
                        setEditingId(null);
                      }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    id={`layer-name-${l.id}`}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      background: '#ffffff',
                      border: '1px solid #0078d4',
                      color: '#323130',
                      fontFamily:
                        'system-ui, -apple-system, "Segoe UI", sans-serif',
                      fontSize: '0.85rem',
                      outline: 'none',
                      borderRadius: 4,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <EditorButton
                      onClick={() => {
                        const input = document.getElementById(
                          `layer-name-${l.id}`,
                        ) as HTMLInputElement | null;
                        if (l.id) onRename(l.id, input?.value || 'Capa');
                        setEditingId(null);
                      }}
                      style={{ flex: 1 }}
                    >
                      Guardar
                    </EditorButton>
                    <EditorButton
                      variant="secondary"
                      onClick={() => setEditingId(null)}
                      style={{ flex: 1 }}
                    >
                      Cancelar
                    </EditorButton>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Fila 1: visibilidad + nombre + nº de tiles ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GhostBtn
                      icon={isVisible ? <IconEye size={16} /> : <IconEyeOff size={16} />}
                      title={isVisible ? 'Ocultar capa' : 'Mostrar capa'}
                      active={isVisible}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (l.id) onToggleVisible(l.id);
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
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
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#605e5c' }}>
                        {tileCount} tile{tileCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                  {/* ── Fila 2: acciones (no aprietan el nombre) ── */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <GhostBtn
                      icon={<IconEdit size={15} />}
                      title="Editar capa"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (l.id) setEditingId(l.id);
                      }}
                    />
                    <GhostBtn
                      icon={<IconUp size={15} />}
                      title="Subir capa"
                      disabled={!canMoveUp}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (l.id) onMove(l.id, 1);
                      }}
                    />
                    <GhostBtn
                      icon={<IconDown size={15} />}
                      title="Bajar capa"
                      disabled={!canMoveDown}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (l.id) onMove(l.id, -1);
                      }}
                    />
                    <GhostBtn
                      icon={<IconDelete size={15} />}
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
                </>
              )}
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
  icon: React.ReactNode;
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
        width: 30,
        height: 30,
        display: 'grid',
        placeItems: 'center',
        background:
          !disabled && hover ? '#f3f2f1' : 'transparent',
        border: 'none',
        borderRadius: 4,
        color: disabled ? '#a19f9d' : '#605e5c',
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
  icon: React.ReactNode;
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
        minWidth: 62,
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        background: active
          ? '#deecf9'
          : !disabled && hover
            ? '#f3f2f1'
            : 'transparent',
        border: active
          ? '1px solid #0078d4'
          : '1px solid transparent',
        borderRadius: 4,
        color: disabled ? '#a19f9d' : active ? '#0078d4' : '#605e5c',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ display: 'grid', placeItems: 'center' }}>{icon}</span>
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

// Botón compacto de las tarjetas de NPC (editar / ubicar).
function npcCardBtn(active: boolean): React.CSSProperties {
  return {
    display: 'grid',
    placeItems: 'center',
    width: 26,
    height: 24,
    padding: 0,
    background: active ? '#deecf9' : '#ffffff',
    color: active ? '#0078d4' : '#605e5c',
    border: `1px solid ${active ? '#0078d4' : '#d1d1d1'}`,
    borderRadius: 4,
    cursor: 'pointer',
  };
}

const paletteTitleBtn: React.CSSProperties = {
  width: 24,
  height: 22,
  display: 'grid',
  placeItems: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: 4,
  color: '#605e5c',
  cursor: 'pointer',
  fontSize: '0.8rem',
  lineHeight: 1,
};

// Celda de la paleta (item/prop): cuadrada, llena su columna del grid, con
// selección azul clara y consistente.
function paletteCellStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    aspectRatio: '1 / 1',
    display: 'grid',
    placeItems: 'center',
    background: active ? '#deecf9' : '#faf9f8',
    border: active ? '2px solid #0078d4' : '1px solid #d1d1d1',
    borderRadius: 4,
    cursor: 'pointer',
    padding: active ? 3 : 4,
    boxShadow: active ? '0 0 0 2px rgba(0,120,212,0.25)' : 'none',
    transition: 'border-color 0.12s ease, box-shadow 0.12s ease',
  };
}
