import { fal } from '@fal-ai/client';
import sharp from 'sharp';
import type { SpritePromptData } from '@/types/sprites';

fal.config({ credentials: process.env.FAL_KEY });

const GENERATION_MODEL = 'fal-ai/nano-banana-pro';
const BG_REMOVAL_MODEL = 'fal-ai/bria/background/remove';

export async function checkAvailable(): Promise<boolean> {
  return !!process.env.FAL_KEY;
}

export async function generateSpriteSheet(
  promptData: SpritePromptData,
  onProgress?: (pct: number) => void
): Promise<Buffer> {
  onProgress?.(5);

  // Generate the sprite sheet image
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (fal as any).subscribe(GENERATION_MODEL, {
    input: {
      prompt: promptData.positive,
      aspect_ratio: promptData.config.rows > 4 ? '9:16' : '1:1',
    },
    logs: false,
    onQueueUpdate: (update: { status: string }) => {
      if (update.status === 'IN_PROGRESS') {
        onProgress?.(30);
      }
    },
  });

  onProgress?.(50);

  // Download the generated image
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageUrl = (result.data as any)?.images?.[0]?.url;
  if (!imageUrl) throw new Error('fal.ai returned no image');

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download generated image: ${imgRes.status}`);
  const generatedBuffer = Buffer.from(await imgRes.arrayBuffer());

  // Record original dimensions before bg removal
  const origMeta = await sharp(generatedBuffer).metadata();
  const origW = origMeta.width!;
  const origH = origMeta.height!;

  onProgress?.(55);

  // Remove background using bria
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bgResult = await (fal as any).subscribe(BG_REMOVAL_MODEL, {
    input: { image_url: imageUrl },
    logs: false,
  });

  onProgress?.(70);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cleanUrl = (bgResult.data as any)?.image?.url;
  if (!cleanUrl) {
    return generatedBuffer;
  }

  const cleanRes = await fetch(cleanUrl);
  if (!cleanRes.ok) return generatedBuffer;

  let cleanBuffer = Buffer.from(await cleanRes.arrayBuffer());

  // If bria changed dimensions, resize back to original to preserve grid alignment
  const cleanMeta = await sharp(cleanBuffer).metadata();
  if (cleanMeta.width !== origW || cleanMeta.height !== origH) {
    cleanBuffer = Buffer.from(
      await sharp(cleanBuffer)
        .resize(origW, origH, { fit: 'fill', kernel: sharp.kernel.nearest })
        .png()
        .toBuffer()
    );
  }

  onProgress?.(80);
  return cleanBuffer;
}
