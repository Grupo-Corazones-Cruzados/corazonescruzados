export type SpriteJobStatus = 'pending' | 'generating' | 'processing' | 'converting' | 'ready' | 'error';

export interface SpriteJob {
  id: string;
  agentId: string;
  digimonName: string;
  status: SpriteJobStatus;
  progress: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface SpriteGenerationRequest {
  agentId: string;
  digimonName: string;
}

export interface SpritePromptData {
  positive: string;
  negative: string;
  chromaKey?: string; // hex color for background removal
  config: {
    frameSize: number;
    cols: number;
    rows: number;
    sheetWidth: number;
    sheetHeight: number;
    backgroundColorHex: string;
    backgroundColorRGB: { r: number; g: number; b: number };
  };
}
