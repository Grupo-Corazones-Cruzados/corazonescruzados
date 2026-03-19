import type { SpritePromptData } from '@/types/sprites';
import type { ActionDescriptions } from '@/types/digimon';

// 4x7 grid (1024x1792)
// Row 0: walk left
// Row 1: idle
// Row 2: working/thinking (personalized)
// Row 3: excited (personalized)
// Row 4: done/celebrating (personalized — different from excited)
// Row 5: sleeping (personalized)
// Row 6: eating (personalized)

const NEGATIVE_PROMPT = `blurry, 3D render, realistic, photographic, smooth shading, gradient background, text, watermark, multiple characters, background elements, floor, ground, furniture, objects, props, fire, flames, energy blasts, projectiles, special effects, aura, magic`;

function makeConfig(w: number, h: number, rows: number): SpritePromptData['config'] {
  return {
    frameSize: 64,
    cols: 4,
    rows,
    sheetWidth: w,
    sheetHeight: h,
    backgroundColorHex: '#FF00FF',
    backgroundColorRGB: { r: 255, g: 0, b: 255 },
  };
}

// Default fallbacks if OpenAI didn't generate action descriptions
const DEFAULT_ACTIONS: ActionDescriptions = {
  working: 'thinking concentrating hand on chin puzzled face looking up deep in thought',
  excited: 'excited happy jumping with arms raised wide open mouth smiling',
  done: 'proud victory pose one arm raised fist up confident satisfied smile',
  sleeping: 'sleeping curled up on ground eyes closed peaceful',
  eating: 'eating food chewing happily facing camera mouth open',
  chromaKey: '#00FF00',
};

export function buildFullSheetPrompt(
  digimonName: string,
  actions?: ActionDescriptions,
  visualDescription?: string,
): SpritePromptData {
  const a = actions || DEFAULT_ACTIONS;
  const charDesc = visualDescription
    ? `${digimonName} from Digimon anime series, ${visualDescription}`
    : `${digimonName}, the exact character from the Digimon anime series, faithful to the original design`;

  const prompt = `pixel art RPG character sprite sheet, 16-bit style, vibrant saturated colors, bold bright palette, solid white background, PNG, ${charDesc}, single character only no objects no props, 4 columns 7 rows uniform grid on single image, row 1: walking side view 4 frame walk cycle frame1 right foot forward left foot back frame2 feet together standing straight frame3 left foot forward right foot back frame4 feet together standing straight each frame clearly different leg positions, row 2: standing idle facing camera subtle breathing 4 frames, row 3: ${a.working} 4 frames, row 4: ${a.excited} 4 frames, row 5: ${a.done} 4 frames, row 6: ${a.sleeping} 4 frames, row 7: ${a.eating} 4 frames, same consistent character design colors proportions in all 28 cells, IMPORTANT each of the 4 frames in every row must show a clearly different pose or position to create smooth animation sequence frame1 and frame2 and frame3 and frame4 must all be visually distinct from each other with different limb positions body angles and expressions`;

  return {
    positive: prompt,
    negative: NEGATIVE_PROMPT,
    config: makeConfig(1024, 1792, 7),
  };
}

// Legacy exports
export function buildWalkPrompt(digimonName: string): SpritePromptData {
  return buildFullSheetPrompt(digimonName);
}
export function buildActionsPrompt(digimonName: string): SpritePromptData {
  return buildFullSheetPrompt(digimonName);
}
export function buildEatingPrompt(digimonName: string): SpritePromptData {
  return buildFullSheetPrompt(digimonName);
}
export function buildSpritePrompt(digimonName: string): SpritePromptData {
  return buildFullSheetPrompt(digimonName);
}
