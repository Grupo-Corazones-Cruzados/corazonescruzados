#!/usr/bin/env node
/**
 * Convierte el catálogo de objetos a imágenes para el proyecto de Godot.
 *
 * Los objetos están dibujados como SVG dentro de `items.ts` (55 piezas hechas a
 * mano con rectángulos). Godot no los puede usar así, y tampoco tiene sentido
 * volver a dibujarlos: se rasterizan una vez.
 *
 * Se renderizan a 16 px —su tamaño real de diseño— y se escalan a 64 con vecino
 * más cercano, para que el resultado siga siendo pixel art nítido en vez de una
 * versión suavizada.
 *
 *   node scripts/prepare-godot-items.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ITEMS } from '../components/landing/world/items.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'godot', 'assets', 'objetos');

/** Tamaño nativo del dibujo. */
const NATIVO = 16;
/** Tamaño final: un tile se ve a 64 px, así que el objeto ocupa una casilla. */
const FINAL = 64;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const manifiesto = [];
  for (const item of ITEMS) {
    const png = await sharp(Buffer.from(item.icon), { density: 384 })
      .resize(NATIVO, NATIVO, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // El escalado va aparte y con `nearest`: si se hiciera en el render del SVG,
    // sharp interpolaría y el borde perdería el filo.
    await sharp(png)
      .resize(FINAL, FINAL, { kernel: 'nearest' })
      .png()
      .toFile(path.join(OUT_DIR, `${item.id}.png`));

    manifiesto.push({ id: item.id, label: item.label, category: item.category });
  }

  await writeFile(
    path.join(OUT_DIR, 'objetos.json'),
    JSON.stringify({ size: FINAL, items: manifiesto }, null, 2),
    'utf8',
  );

  const porCategoria = manifiesto.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`✔ ${manifiesto.length} objetos → godot/assets/objetos/`);
  for (const [cat, n] of Object.entries(porCategoria)) {
    console.log(`   ${cat.padEnd(14)} ${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
