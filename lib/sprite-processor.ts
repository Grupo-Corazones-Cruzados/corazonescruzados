import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { getCitizensDir } from './world';

const FRAME = 64;
const COLS = 4;

// ── Source layout (4x7 sheet from fal.ai): ───────────────
// Row 0: walk left (4 frames)
// Row 1: idle standing (4 frames)
// Row 2: working/thinking (4 frames) — personalized
// Row 3: excited (4 frames) — personalized
// Row 4: done/celebrating (4 frames) — personalized, different from excited
// Row 5: sleeping (4 frames) — personalized
// Row 6: eating (4 frames) — personalized

// ── Grid helpers ───────────────────────────────────────

async function resizeSheet(inputBuffer: Buffer, cols: number, rows: number): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(cols * FRAME, rows * FRAME, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
}

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

// ── Extract a single cell from source at any resolution ──

async function extractCell(source: Buffer, col: number, row: number, cellW: number, cellH: number, srcH: number, yShift = 0): Promise<Buffer> {
  // yShift: percentage (-15 to +15) to shift extraction window vertically
  // Negative = shift up (show more of the bottom / feet)
  // Positive = shift down (show more of the top / head)
  const shiftPx = Math.round(cellH * (yShift / 100));
  const rawTop = Math.round(row * cellH) + shiftPx;
  const cropTop = Math.max(0, rawTop);
  const cropH = Math.min(Math.round(cellH), srcH - cropTop);

  return sharp(source)
    .extract({
      left: Math.round(col * cellW),
      top: cropTop,
      width: Math.round(cellW),
      height: Math.max(1, cropH),
    })
    .resize(FRAME, FRAME, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
}

// ── Build a row by extracting 4 cells individually ──

async function buildRowFromSource(source: Buffer, row: number, cellW: number, cellH: number, srcH: number, yShift = 0): Promise<Buffer> {
  const cells = await Promise.all(
    [0, 1, 2, 3].map(col => extractCell(source, col, row, cellW, cellH, srcH, yShift))
  );
  return composeRow(cells);
}

// ── Process 4x6 sheet into individual sprite files ──────

export async function processFullSheet(imageBuffer: Buffer, yShift = 0): Promise<{
  walk: Buffer;
  actions: Buffer;
  done: Buffer;
  eating: Buffer;
}> {
  // Read actual dimensions (handles any resolution from fal.ai + bria)
  const meta = await sharp(imageBuffer).metadata();
  const srcW = meta.width!;
  const srcH = meta.height!;
  const totalRows = 7;
  const cellW = srcW / COLS;          // actual pixels per cell width
  const cellH = srcH / totalRows;     // actual pixels per cell height

  // Extract each row by picking 4 cells individually from source
  // yShift: negative = show more feet, positive = show more head
  const walkLeftRow = await buildRowFromSource(imageBuffer, 0, cellW, cellH, srcH, yShift);
  const idleRow = await buildRowFromSource(imageBuffer, 1, cellW, cellH, srcH, yShift);
  const workingRow = await buildRowFromSource(imageBuffer, 2, cellW, cellH, srcH, yShift);
  const excitedRow = await buildRowFromSource(imageBuffer, 3, cellW, cellH, srcH, yShift);
  const doneRow = await buildRowFromSource(imageBuffer, 4, cellW, cellH, srcH, yShift);
  const sleepingRow = await buildRowFromSource(imageBuffer, 5, cellW, cellH, srcH, yShift);
  const eatingRow = await buildRowFromSource(imageBuffer, 6, cellW, cellH, srcH, yShift);

  // Walk right = horizontal flip of walk left
  const walkRightRow = await flipRow(walkLeftRow);

  // walk.png (4 rows): down, up, left, right
  // World uses: row 2 = left, row 3 = right (flipped via canvas)
  const walk = await stackRows([idleRow, idleRow, walkLeftRow, walkRightRow]);

  // actions.png (4 rows): working, sleeping, excited/hovered, idle
  const actions = await stackRows([workingRow, sleepingRow, excitedRow, idleRow]);

  // done.png (1 row): celebration — separate from excited
  const done = doneRow;

  // eating.png (1 row)
  const eating = eatingRow;

  return { walk, actions, done, eating };
}

// ── Legacy functions (used by upload endpoint) ──────────

export async function processWalkSheet(imageBuffer: Buffer): Promise<Buffer> {
  return resizeSheet(imageBuffer, COLS, COLS);
}

export async function processActionsSheet(imageBuffer: Buffer): Promise<Buffer> {
  return resizeSheet(imageBuffer, COLS, COLS);
}

export async function buildDoneSheet(actionsBuffer: Buffer): Promise<Buffer> {
  return extractRow(actionsBuffer, 2);
}

export async function processEatingSheet(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(COLS * FRAME, FRAME, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
}

// ── Save sprites ────────────────────────────────────────

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
