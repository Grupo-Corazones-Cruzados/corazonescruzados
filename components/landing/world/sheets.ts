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
  s: number; // sheet index
  sx: number;
  sy: number;
  c?: 1; // collides
};

export type LayerData = { tiles: Tile[] };

export type WorldMapData = {
  name: string;
  width: number;
  height: number;
  layers: LayerData[];
  spawnX: number; // tile col where the player appears
  spawnY: number; // tile row where the player appears
  isAdmin?: boolean;
};
