#!/usr/bin/env node
/**
 * Extrae una PIEZA SUELTA (gorra, capucha, pañuelo…) de la hoja donde el modelo
 * la dibujó puesta, para poder ponerla ENCIMA de cualquier peinado.
 * ============================================================================
 *
 * Por qué hace falta: el generador dibuja al personaje entero con el accesorio
 * puesto sobre el pelo base. Si esa hoja se usa tal cual, el accesorio y el
 * peinado son la MISMA ranura y elegir uno borra el otro. En un creador de
 * personajes eso no vale: el jugador elige peinado **y** accesorio por separado.
 *
 * Cómo: se compara la hoja con la plantilla de la que salió. Lo que cambió es el
 * accesorio. La comparación píxel a píxel sola no sirve —entre dos tiradas hay
 * ruido de ±1 px—, así que se limpia con lo que ya sabemos:
 *   1. Solo cuenta lo que cambia de verdad (distancia de color alta).
 *   2. Se queda la MASA conectada más grande; un accesorio es una mancha, no
 *      píxeles sueltos por la cara.
 *   3. Se tapan sus huecos y se quitan las motas.
 *
 * USO
 *   node scripts/extraer-capa.mjs mujer tocado --todas
 *   node scripts/extraer-capa.mjs hombre tocado gorra-parda
 *
 * SALIDA
 *   public/personajes/<sexo>/<parte>-capa/<id>.png   (solo el accesorio, con alfa)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const RAIZ = process.cwd();
const SALIDA = 'public/personajes';
const ANCHO = 96, ALTO = 128, VISTAS = 4;
/** Un accesorio de cabeza no baja del cuello; así se evita ruido del cuerpo. */
const LIMITE = 52;

const dist = (a, i, b, j) =>
  Math.abs(a[i] - b[j]) + Math.abs(a[i + 1] - b[j + 1]) + Math.abs(a[i + 2] - b[j + 2]);

/** Componentes conectadas de la marca; devuelve la mayor de cada vista. */
function masaMayorPorVista(marca, W, H) {
  const visto = new Uint8Array(W * H);
  const salida = new Uint8Array(W * H);
  for (let v = 0; v < VISTAS; v++) {
    const x0 = v * ANCHO, x1 = x0 + ANCHO;
    let mejor = [];
    for (let p = 0; p < W * H; p++) {
      const px = p % W;
      if (px < x0 || px >= x1 || !marca[p] || visto[p]) continue;
      const grupo = [], pila = [p];
      visto[p] = 1;
      while (pila.length) {
        const q = pila.pop();
        grupo.push(q);
        const qx = q % W, qy = (q - qx) / W;
        for (const r of [qx > x0 ? q - 1 : -1, qx < x1 - 1 ? q + 1 : -1, qy > 0 ? q - W : -1, qy < H - 1 ? q + W : -1]) {
          if (r < 0 || visto[r] || !marca[r]) continue;
          visto[r] = 1;
          pila.push(r);
        }
      }
      if (grupo.length > mejor.length) mejor = grupo;
    }
    for (const p of mejor) salida[p] = 1;
  }
  return salida;
}

function taparHuecos(marca, W, H) {
  const fuera = new Uint8Array(W * H);
  const pila = [];
  const meter = (p) => { if (!marca[p] && !fuera[p]) { fuera[p] = 1; pila.push(p); } };
  for (let x = 0; x < W; x++) { meter(x); meter((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { meter(y * W); meter(y * W + W - 1); }
  while (pila.length) {
    const p = pila.pop(), x = p % W, y = (p - x) / W;
    if (x > 0) meter(p - 1);
    if (x < W - 1) meter(p + 1);
    if (y > 0) meter(p - W);
    if (y < H - 1) meter(p + W);
  }
  for (let p = 0; p < W * H; p++) if (!marca[p] && !fuera[p]) marca[p] = 1;
}

async function extraer(sexo, parte, id) {
  const base = path.join(RAIZ, SALIDA, 'base', `${sexo}.png`);
  const pieza = path.join(RAIZ, SALIDA, sexo, parte, `${id}.png`);
  const A = await sharp(base).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(pieza).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = A.info.width, H = A.info.height;

  const marca = new Uint8Array(W * H);
  for (let y = 0; y < Math.min(LIMITE, H); y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const cambia = A.data[i + 3] !== B.data[i + 3] || (B.data[i + 3] > 0 && dist(A.data, i, B.data, i) > 90);
      if (cambia) marca[y * W + x] = 1;
    }
  }
  const masa = masaMayorPorVista(marca, W, H);
  taparHuecos(masa, W, H);

  const capa = Buffer.alloc(W * H * 4, 0);
  let px = 0;
  for (let p = 0; p < W * H; p++) {
    if (!masa[p] || !B.data[p * 4 + 3]) continue;
    const i = p * 4;
    capa[i] = B.data[i]; capa[i + 1] = B.data[i + 1]; capa[i + 2] = B.data[i + 2]; capa[i + 3] = 255;
    px++;
  }
  const destino = path.join(RAIZ, SALIDA, sexo, `${parte}-capa`);
  await fs.mkdir(destino, { recursive: true });
  await sharp(capa, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(destino, `${id}.png`));
  console.log(`  ✔ ${sexo}/${parte}-capa/${id}.png  (${px} px de accesorio)`);
}

const [sexo, parte, id] = process.argv.slice(2);
if (!sexo || !parte) {
  console.error('Uso: node scripts/extraer-capa.mjs <hombre|mujer> <tocado> [id|--todas]');
  process.exit(1);
}
const dir = path.join(RAIZ, SALIDA, sexo, parte);
const ids = (!id || id === '--todas')
  ? (await fs.readdir(dir)).filter((f) => f.endsWith('.png') && !f.includes('crudo')).map((f) => f.replace('.png', ''))
  : [id];
for (const uno of ids) await extraer(sexo, parte, uno);
