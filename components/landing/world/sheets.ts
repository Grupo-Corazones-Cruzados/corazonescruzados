// All loadable tilesets. Order matters — index is referenced by saved
// tile data (`s` field), so don't reorder once maps are saved.

export type SheetDef = {
  id: string;
  name: string; // human label (Spanish)
  category: 'terreno' | 'edificios' | 'interiores' | 'decoracion' | 'agua';
  url: string;
  cols: number;
  rows: number;
  // Per-tile names used by the search box. Optional — tiles without
  // a name still appear, just don't match search.
};

export const TILE_PX = 32;

export const SHEETS: SheetDef[] = [
  {
    id: 'terrain',
    name: 'Terreno',
    category: 'terreno',
    url: '/tiles/Terrain_and_Outside.png',
    cols: 32,
    rows: 32,
  },
  {
    id: 'cliffs',
    name: 'Acantilados',
    category: 'terreno',
    url: '/tiles/LPC_cliffs_grass.png',
    cols: 12,
    rows: 9,
  },
  {
    id: 'outdoor_32',
    name: 'Exterior básico',
    category: 'terreno',
    url: '/tiles/outdoor_32.png',
    cols: 9,
    rows: 8,
  },
  {
    id: 'light_forest',
    name: 'Bosque claro',
    category: 'terreno',
    url: '/tiles/light_forest.png',
    cols: 8,
    rows: 19,
  },
  {
    id: 'dark_forest',
    name: 'Bosque oscuro',
    category: 'terreno',
    url: '/tiles/dark_forest.png',
    cols: 8,
    rows: 19,
  },
  {
    id: 'water',
    name: 'Agua animada',
    category: 'agua',
    url: '/tiles/wateranimate2.png',
    cols: 18,
    rows: 12,
  },
  {
    id: 'exterior',
    name: 'Edificios',
    category: 'edificios',
    url: '/tiles/Exterior_Tiles.png',
    cols: 32,
    rows: 32,
  },
  {
    id: 'interior',
    name: 'Interior 1',
    category: 'interiores',
    url: '/tiles/Interior.png',
    cols: 32,
    rows: 32,
  },
  {
    id: 'interior2',
    name: 'Interior 2',
    category: 'interiores',
    url: '/tiles/Interior_2.png',
    cols: 32,
    rows: 26,
  },
  {
    id: 'objects',
    name: 'Decoración',
    category: 'decoracion',
    url: '/tiles/Outside_Objects.png',
    cols: 32,
    rows: 32,
  },
  {
    id: 'dungeon_utumno',
    name: 'Dungeon Crawl (RPG completo)',
    category: 'decoracion',
    url: '/tiles/DungeonCrawl_ProjectUtumno.png',
    cols: 64,
    rows: 48,
  },
];

export const CATEGORIES: {
  id: SheetDef['category'];
  label: string;
}[] = [
  { id: 'terreno', label: 'Terreno' },
  { id: 'edificios', label: 'Edificios' },
  { id: 'decoracion', label: 'Decoración' },
  { id: 'interiores', label: 'Interiores' },
  { id: 'agua', label: 'Agua' },
];

export type Tile = {
  x: number;
  y: number;
  s: number; // sheet index (ignored when `color` is set)
  sx: number;
  sy: number;
  c?: 1; // collides
  // Solid-color tile. When set, the renderer paints a filled rect of
  // this color instead of looking up the sheet sprite, and `s/sx/sy`
  // are ignored. Used by the Colores palette.
  color?: string;
};

// Z-layer derived from the sheet's category. Ground (terreno, agua)
// goes underneath; everything else (edificios, decoracion, interiores)
// stacks on top so transparent decoration tiles still see the grass /
// stone they were painted over.
export function tileZ(sheetIdx: number): 0 | 1 {
  const cat = SHEETS[sheetIdx]?.category;
  return cat === 'terreno' || cat === 'agua' ? 0 : 1;
}

// Each layer is an independent paint surface — tiles in different
// layers never overwrite each other. Layers stack in array order
// (first = bottom, last = top). `id` is stable within a map and is
// used by the editor for active-layer selection across reorders.
export type LayerData = {
  id?: string;
  name?: string;
  visible?: boolean;
  tiles: Tile[];
};

export type ItemPlacement = {
  id: string; // unique within map (e.g. "abc123")
  itemId: string; // ITEMS catalog id
  x: number; // tile col
  y: number; // tile row
};

// A non-collectible world object placed on a tile. Reuses the items
// catalog for its sprite. Optionally emits light and/or fires a trigger
// when the player interacts (E) or steps onto its tile.
export type PropLight = {
  radius: number; // tiles
  color: string; // hex
  mode: 'steady' | 'blink' | 'pulse' | 'flicker' | 'rainbow';
  periodMs: number;
  intensity: number; // 0..1
};

export type PropTriggerActivation = 'interact' | 'step';

// `tile-change` mutates one tile (paint a new sprite, or clear it).
// `cinematic` plays a cinematic by slug (one-shot per session unless
// the prop's `repeat` flag is set). `layer-toggle` flips the
// `visible` flag on a named layer.
export type PropTrigger =
  | {
      kind: 'tile-change';
      activation: PropTriggerActivation;
      layerId: string;
      tileX: number;
      tileY: number;
      newTile: Tile | null; // null = erase
      repeat?: boolean;
    }
  | {
      kind: 'cinematic';
      activation: PropTriggerActivation;
      cinematicSlug: string;
      repeat?: boolean;
    }
  | {
      kind: 'layer-toggle';
      activation: PropTriggerActivation;
      layerId: string;
      repeat?: boolean;
    };

export type WorldProp = {
  id: string;
  x: number;
  y: number;
  itemId: string; // ITEMS catalog id (sprite)
  solid?: boolean;
  light?: PropLight | null;
  trigger?: PropTrigger | null;
};

// A door / trigger inside a map scene. When the player walks onto a tile
// covered by the rectangle, the runtime swaps to `targetScene`. If
// `targetSpawnX/Y` are present they override the destination map's
// default spawn (otherwise the destination's `spawnX/Y` is used).
export type Transition = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  targetScene: string;
  targetSpawnX?: number;
  targetSpawnY?: number;
  fadeMs?: number;
};

export type WorldMapData = {
  name: string;
  width: number;
  height: number;
  layers: LayerData[];
  items: ItemPlacement[];
  spawnX: number; // tile col where the player appears
  spawnY: number; // tile row where the player appears
  // 0 = full daylight, 1 = pitch black before lights are applied.
  ambientDarkness?: number;
  transitions?: Transition[];
  props?: WorldProp[];
  isAdmin?: boolean;
};

// ── Scenes (game-engine-style) ──────────────────────────────────────
// A scene is the unit of "what's loaded right now". `map` scenes own
// a matching `world_maps` row (keyed by `slug`); cinematic scenes have
// no world_maps row — all their data lives in `CinematicData`.
export type SceneKind = 'map' | 'cinematic';

export type SceneMeta = {
  slug: string;
  kind: SceneKind;
  name: string;
  orderIdx: number;
  musicUrl?: string | null;
  musicVolume?: number;
  eventTrigger?: string | null;
  updatedAt?: string;
};

// Cinematic frame coordinate space is fixed at 1280×720; the player
// view scales it to fit the viewport.
export type CinematicBackdrop =
  | { kind: 'color'; color: string }
  | { kind: 'image'; url: string };

export type CinematicCharacter = {
  id: string;
  spriteUrl: string;
  x: number;
  y: number;
  flip?: boolean;
  scale?: number;
};

export type CinematicDialog = {
  speaker: string;
  text: string;
  portraitUrl?: string;
};

export type CinematicFrame = {
  id: string;
  backdrop: CinematicBackdrop;
  characters: CinematicCharacter[];
  dialog?: CinematicDialog;
  // ms; undefined = wait for click/Space/Enter.
  duration?: number;
  transition?: 'cut' | 'fade';
};

export type CinematicData = {
  frames: CinematicFrame[];
};
