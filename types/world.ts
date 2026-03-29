export interface WorldConfig {
  gridCols: number;
  gridRows: number;
  floor: string[][];
  props: PropInstance[];
  characters: Record<string, string>; // agentId → anchorName
  citizens: CitizenDef[];
  wanderPoints: WanderPoint[];
  propImages: Record<string, string>; // propId → relative path
  tiles: Record<string, string>;      // tileId → relative path
}

export type AnimationPhase = 'idle' | 'walk' | 'work' | 'excited' | 'rest' | 'done' | 'eating';

export type FrameConfig = Partial<Record<AnimationPhase, number[]>>;

export interface CitizenDef {
  agentId: string;
  name: string;
  sprite: string;
  position: string;
  type: 'agent' | 'npc';
  scale?: number;       // 0.5-2.0, default 1.0 — affects world display size
  flipWalk?: boolean;   // true = flip sprite when walking right (default), false = flip when walking left
  frameConfig?: FrameConfig; // per-animation selected frame indices (e.g. { idle: [0,2], walk: [0,1,2,3] })
  yShift?: number;           // -15 to 15 — vertical crop offset for sprite extraction (negative = more feet)
  avatarCrop?: { x: number; y: number; size: number }; // face crop for bubble avatar (source pixel coords)
  walkSheetCols?: number;     // columns in walk sprite sheet (default 4)
  walkSheetRows?: number;     // rows in walk sprite sheet (default 4)
  walkRow?: number;           // which row is the walk animation (default 2)
}

export interface PropInstance {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layer: 'below' | 'above';
  anchors?: Anchor[];
}

export interface Anchor {
  name: string;
  ox: number;
  oy: number;
  type: 'work' | 'rest' | 'social' | 'utility';
}

export interface WanderPoint {
  name: string;
  x: number;
  y: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
