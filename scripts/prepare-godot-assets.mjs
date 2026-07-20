#!/usr/bin/env node
/**
 * Prepara los tilesets para el proyecto de Godot.
 *
 * Los PNG de tilesets vienen con fondo BLANCO en vez de transparencia. El juego
 * web lo resolvía recorriendo los píxeles **en cada arranque**, para las 11
 * hojas y por duplicado — una de ellas tiene 3072 tiles. Aquí se hace una sola
 * vez, en el momento de preparar el proyecto, y Godot ya recibe PNG con alfa.
 *
 * Además copia solo las hojas que los mapas usan de verdad.
 *
 *   node scripts/prepare-godot-assets.mjs
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'godot', 'import', 'maps');
const OUT_DIR = path.join(ROOT, 'godot', 'assets', 'tiles');

/** Umbral de "casi blanco", heredado del renderer anterior. */
const WHITE_CUTOFF = 250;

/**
 * Catálogo de hojas. El ORDEN IMPORTA: el índice es lo que guardan los mapas en
 * su campo `s`. Reordenar esta lista corrompe todos los mapas existentes.
 * Copiado de components/landing/world/sheets.ts.
 */
const SHEETS = [
  { id: 'terrain', file: 'Terrain_and_Outside.png', cols: 32, rows: 32 },
  { id: 'cliffs', file: 'LPC_cliffs_grass.png', cols: 12, rows: 9 },
  { id: 'outdoor', file: 'outdoor_32.png', cols: 9, rows: 8 },
  { id: 'light_forest', file: 'light_forest.png', cols: 8, rows: 19 },
  { id: 'dark_forest', file: 'dark_forest.png', cols: 8, rows: 19 },
  { id: 'water', file: 'wateranimate2.png', cols: 18, rows: 12 },
  { id: 'exterior', file: 'Exterior_Tiles.png', cols: 32, rows: 32 },
  { id: 'interior', file: 'Interior.png', cols: 32, rows: 32 },
  { id: 'interior2', file: 'Interior_2.png', cols: 32, rows: 26 },
  { id: 'outside_objects', file: 'Outside_Objects.png', cols: 32, rows: 32 },
  { id: 'dungeon', file: 'DungeonCrawl_ProjectUtumno.png', cols: 64, rows: 48 },
];

async function chromaKey(src, dest) {
  const img = sharp(src).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  let cleared = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] >= WHITE_CUTOFF && data[i + 1] >= WHITE_CUTOFF && data[i + 2] >= WHITE_CUTOFF) {
      data[i + 3] = 0;
      cleared++;
    }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(dest);
  return { cleared, total: info.width * info.height, w: info.width, h: info.height };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // Qué hojas hacen falta de verdad, según los mapas exportados.
  const used = new Set();
  let files = [];
  try {
    files = (await readdir(MAPS_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    console.error('✖ No hay mapas exportados. Ejecuta antes: node scripts/export-maps-to-godot.mjs');
    process.exit(1);
  }
  for (const f of files) {
    const m = JSON.parse(await readFile(path.join(MAPS_DIR, f), 'utf8'));
    for (const s of m.usedSheets ?? []) used.add(s);
  }

  if (used.size === 0) {
    console.log('Los mapas no usan ninguna hoja de tiles.');
    return;
  }

  const manifest = [];
  for (const idx of [...used].sort((a, b) => a - b)) {
    const def = SHEETS[idx];
    if (!def) {
      console.warn(`⚠ Índice de hoja ${idx} desconocido; se omite.`);
      continue;
    }
    const src = path.join(ROOT, 'public', 'tiles', def.file);
    const dest = path.join(OUT_DIR, `${def.id}.png`);
    const r = await chromaKey(src, dest);
    manifest.push({ index: idx, id: def.id, cols: def.cols, rows: def.rows, file: `${def.id}.png` });
    console.log(
      `✔ ${def.id.padEnd(16)} ${r.w}×${r.h}px  ${((r.cleared / r.total) * 100).toFixed(1)}% a transparente`,
    );
  }

  // Tiles de color sólido: no salen de ninguna hoja, así que se genera un
  // atlas propio con una celda por color. Así siguen siendo tiles normales
  // dentro del mismo TileMapLayer, en vez de nodos aparte.
  const colors = new Set();
  for (const f of files) {
    const m = JSON.parse(await readFile(path.join(MAPS_DIR, f), 'utf8'));
    for (const l of m.layers ?? []) {
      for (const t of l.tiles ?? []) if (t.color) colors.add(t.color);
    }
  }

  const colorList = [...colors].sort();
  if (colorList.length > 0) {
    const TILE = 32;
    const composites = colorList.map((hex, i) => ({
      input: {
        create: {
          width: TILE,
          height: TILE,
          channels: 4,
          background: hex,
        },
      },
      left: i * TILE,
      top: 0,
    }));
    await sharp({
      create: {
        width: TILE * colorList.length,
        height: TILE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      .png()
      .toFile(path.join(OUT_DIR, 'colors.png'));
    console.log(`✔ ${'colors'.padEnd(16)} ${colorList.length} color(es): ${colorList.join(', ')}`);
  }

  // El importador de Godot necesita saber qué índice corresponde a qué imagen.
  await writeFile(
    path.join(OUT_DIR, 'sheets.json'),
    JSON.stringify(
      { tileSize: 32, sheets: manifest, colors: colorList, colorsFile: 'colors.png' },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\n${manifest.length} hoja(s) preparadas → godot/assets/tiles/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
