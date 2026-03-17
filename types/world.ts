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

export interface CitizenDef {
  agentId: string;
  name: string;
  sprite: string;
  position: string;
  type: 'agent' | 'npc';
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
