import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { getCitizensDir } from './world';

const FRAME = 64;
const COLS = 4;

// ── Resize to target sprite sheet size ─────────────────

async function resizeTo256(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(COLS * FRAME, COLS * FRAME, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
}

// ── Grid helpers ───────────────────────────────────────

async function extractRow(sheet: Buffer, row: number): Promise<Buffer> {
  return sharp(sheet)
    .extract({ left: 0, top: row * FRAME, width: COLS * FRAME, height: FRAME })
    .png()
    .toBuffer();
}

async function flipRow(rowBuffer: Buffer): Promise<Buffer> {
  const frames: Buffer[] = [];
  for (let col = 0; col < COLS; col++) {
    frames.push(
      await sharp(rowBuffer)
        .extract({ left: col * FRAME, top: 0, width: FRAME, height: FRAME })
        .flop()
        .png()
        .toBuffer()
    );
  }
  return composeRow(frames);
}

async function composeRow(frames: Buffer[]): Promise<Buffer> {
  return sharp({
    create: { width: COLS * FRAME, height: FRAME, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(frames.map((f, i) => ({ input: f, left: i * FRAME, top: 0 })))
    .png()
    .toBuffer();
}

async function stackRows(rows: Buffer[]): Promise<Buffer> {
  return sharp({
    create: { width: COLS * FRAME, height: rows.length * FRAME, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(rows.map((r, i) => ({ input: r, left: 0, top: i * FRAME })))
    .png()
    .toBuffer();
}

// ── Convert walk sheet (from fal.ai: down, up, left, right) ──

export async function processWalkSheet(imageBuffer: Buffer): Promise<Buffer> {
  const resized = await resizeTo256(imageBuffer);
  // fal.ai walk sheet rows: 0=down, 1=up, 2=left, 3=right
  // World format wants: 0=down, 1=up, 2=left, 3=right (same!)
  return resized;
}

// ── Convert actions sheet (from fal.ai: sitting, sleeping, talking, idle) ──

export async function processActionsSheet(imageBuffer: Buffer): Promise<Buffer> {
  const resized = await resizeTo256(imageBuffer);
  // fal.ai actions rows: 0=sitting(working), 1=sleeping, 2=talking, 3=idle
  // World format wants: 0=working, 1=sleeping, 2=talking, 3=idle (same!)
  return resized;
}

// ── Build done sheet from actions sheet row 2 (excited/celebration) ──

export async function buildDoneSheet(actionsBuffer: Buffer): Promise<Buffer> {
  return extractRow(actionsBuffer, 2);
}

// ── Process eating sheet (1 row of 4 frames) ──

export async function processEatingSheet(imageBuffer: Buffer): Promise<Buffer> {
  // Resize to 256x64 (4 frames of 64x64 in a single row)
  return sharp(imageBuffer)
    .resize(COLS * FRAME, FRAME, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
}

// ── Save sprites ───────────────────────────────────────

export async function saveSprites(
  agentId: string,
  sheets: { walk: Buffer; actions: Buffer; done: Buffer; eating?: Buffer }
): Promise<string> {
  const citizensDir = getCitizensDir();
  await fs.mkdir(citizensDir, { recursive: true });

  const writes = [
    fs.writeFile(path.join(citizensDir, `${agentId}_walk.png`), sheets.walk),
    fs.writeFile(path.join(citizensDir, `${agentId}_actions.png`), sheets.actions),
    fs.writeFile(path.join(citizensDir, `${agentId}_done.png`), sheets.done),
  ];
  if (sheets.eating) {
    writes.push(fs.writeFile(path.join(citizensDir, `${agentId}_eating.png`), sheets.eating));
  }
  await Promise.all(writes);

  return citizensDir;
}

export async function validateDimensions(buffer: Buffer): Promise<boolean> {
  const meta = await sharp(buffer).metadata();
  return (meta.width ?? 0) > 0 && (meta.height ?? 0) > 0;
}
