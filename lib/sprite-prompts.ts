import type { SpritePromptData } from '@/types/sprites';

const WALK_PROMPT = `32-bit pixel art, top-down RPG style, consistent subtle top-left shading, soft sub-pixel shading with 3-4 value ramps per color, selective dark outlines (hue-shifted not black), slight dithering on large surfaces, warm muted palette, cozy indie game aesthetic, clean readable silhouettes, no anti-aliasing to background, transparent background, PNG, character sprite sheet for a pixel RPG, 64x64 pixel character, 4 rows x 4 columns grid layout on single image, row 1: walking down (toward camera) 4 frames, row 2: walking up (away from camera) 4 frames, row 3: walking left 4 frames, row 4: walking right 4 frames, {{CHARACTER}}, subtle walk cycle bob, arms swinging, consistent proportions across all frames, character fills about 80% of each cell height`;

const ACTIONS_PROMPT = `32-bit pixel art, top-down RPG style, consistent subtle top-left shading, soft sub-pixel shading with 3-4 value ramps per color, selective dark outlines (hue-shifted not black), slight dithering on large surfaces, warm muted palette, cozy indie game aesthetic, clean readable silhouettes, no anti-aliasing to background, transparent background, PNG, character action sprite sheet for a pixel RPG, 64x64 pixel character, 4 rows x 4 columns grid layout on single image, CHARACTER ONLY no props no desk no chair no objects in any frame, row 1: working typing gesture facing up (away from camera back to viewer) 4 frames, row 2: sleeping resting pose curled up or head drooping facing down eyes closed 4 frames, row 3: excited waving celebrating happy jumping facing camera 4 frames, row 4: standing idle facing camera with subtle breathing animation 4 frames, {{CHARACTER}}, consistent with walking sheet style, character fills about 80% of each cell height`;

const EATING_PROMPT = `32-bit pixel art, top-down RPG style, consistent subtle top-left shading, soft sub-pixel shading with 3-4 value ramps per color, selective dark outlines (hue-shifted not black), slight dithering on large surfaces, warm muted palette, cozy indie game aesthetic, clean readable silhouettes, no anti-aliasing to background, transparent background, PNG, character eating sprite sheet for a pixel RPG, 64x64 pixel character, 1 row x 4 columns grid layout on single image, row 1: eating food happily munching chewing with small food item 4 frames showing bite chew chew swallow sequence, CHARACTER ONLY no table no plate no background, {{CHARACTER}}, consistent with walking sheet style, character fills about 80% of each cell height`;

const NEGATIVE_PROMPT = `blurry, 3D render, realistic, photographic, smooth shading, gradient background, text, watermark, multiple characters, background elements, floor, ground`;

function makeConfig(w: number, h: number): SpritePromptData['config'] {
  return {
    frameSize: 64,
    cols: 4,
    rows: 4,
    sheetWidth: w,
    sheetHeight: h,
    backgroundColorHex: '#FF00FF',
    backgroundColorRGB: { r: 255, g: 0, b: 255 },
  };
}

export function buildWalkPrompt(digimonName: string): SpritePromptData {
  return {
    positive: WALK_PROMPT.replace('{{CHARACTER}}', `${digimonName} is a digimon, it is a digital monster from the digimon series`),
    negative: NEGATIVE_PROMPT,
    config: makeConfig(1024, 1024),
  };
}

export function buildActionsPrompt(digimonName: string): SpritePromptData {
  return {
    positive: ACTIONS_PROMPT.replace('{{CHARACTER}}', `${digimonName} is a digimon, it is a digital monster from the digimon series`),
    negative: NEGATIVE_PROMPT,
    config: makeConfig(1024, 1024),
  };
}

export function buildEatingPrompt(digimonName: string): SpritePromptData {
  return {
    positive: EATING_PROMPT.replace('{{CHARACTER}}', `${digimonName} is a digimon, it is a digital monster from the digimon series`),
    negative: NEGATIVE_PROMPT,
    config: makeConfig(1024, 256), // 1 row of 4 frames
  };
}

// Legacy
export function buildSpritePrompt(digimonName: string): SpritePromptData {
  return buildWalkPrompt(digimonName);
}
