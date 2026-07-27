#!/usr/bin/env node
/**
 * Convierte una lámina de despiece en piezas listas para el esqueleto.
 * ====================================================================
 *
 * El modelo dibuja las piezas sueltas repartidas por el lienzo. Aquí se:
 *   1. quita el fondo blanco y su halo (lo mismo que ya se hacía con las hojas),
 *   2. localizan las piezas como **manchas conectadas** —cada pieza es una isla—,
 *   3. clasifican por su sitio y su tamaño: la cabeza arriba, el torso en el
 *      centro, los brazos a los lados, las piernas abajo, la falda abajo centro,
 *   4. calcula el PIVOTE de cada una: el punto por el que gira. En un brazo es
 *      el centro de su borde superior (el hombro); en una pierna, igual (la
 *      cadera); en la cabeza, el centro de su borde inferior (el cuello).
 *   5. empaquetan todas en un atlas PNG + un JSON que lee Godot.
 *
 * Se reduce al tamaño de juego por MAYORÍA de color, igual que las hojas, para
 * que no se cuele el borde blanco del fondo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const RAIZ = process.cwd();
/** Altura final del personaje montado, en píxeles de juego. */
const ALTO_PERSONAJE = 112;

const luz = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

async function sinFondo(ruta) {
  const { data, info } = await sharp(ruta).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const esFondo = (i) => data[i] > 214 && data[i + 1] > 214 && data[i + 2] > 214
    && Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) < 16;
  const pila = [];
  for (let x = 0; x < W; x++) pila.push(x, 0, x, H - 1);
  for (let y = 0; y < H; y++) pila.push(0, y, W - 1, y);
  const visto = new Uint8Array(W * H);
  while (pila.length) {
    const y = pila.pop(), x = pila.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x;
    if (visto[p] || !esFondo(p * 4)) continue;
    visto[p] = 1; data[p * 4 + 3] = 0;
    pila.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  // Halo: se pelan los bordes claros y sin color que toquen el vacío.
  for (let pasada = 0; pasada < 4; pasada++) {
    const fuera = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!data[i + 3]) continue;
      const toca = (x > 0 && !data[i - 4]) || (x < W - 1 && !data[i + 4])
        || (y > 0 && !data[i - W * 4 + 3 - 3]) || (y < H - 1 && !data[i + W * 4 + 3 - 3]);
      const tocaReal = (x > 0 && data[(y * W + x - 1) * 4 + 3] === 0) || (x < W - 1 && data[(y * W + x + 1) * 4 + 3] === 0)
        || (y > 0 && data[((y - 1) * W + x) * 4 + 3] === 0) || (y < H - 1 && data[((y + 1) * W + x) * 4 + 3] === 0);
      if (!tocaReal) continue;
      const c = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
      if (luz(data[i], data[i + 1], data[i + 2]) > 165 && c < 32) fuera.push(i);
    }
    if (!fuera.length) break;
    for (const i of fuera) data[i + 3] = 0;
  }
  return { data, W, H };
}

/** Islas de píxeles: cada pieza dibujada es una. */
function manchas({ data, W, H }, minPx = 400) {
  const visto = new Uint8Array(W * H);
  const encontradas = [];
  for (let p0 = 0; p0 < W * H; p0++) {
    if (visto[p0] || !data[p0 * 4 + 3]) continue;
    const grupo = [];
    const pila = [p0]; visto[p0] = 1;
    while (pila.length) {
      const p = pila.pop(); grupo.push(p);
      const x = p % W, y = (p - x) / W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q < 0 || visto[q] || !data[q * 4 + 3]) continue;
        visto[q] = 1; pila.push(q);
      }
    }
    if (grupo.length < minPx) continue;
    const xs = grupo.map((p) => p % W), ys = grupo.map((p) => (p - (p % W)) / W);
    encontradas.push({
      x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys),
      n: grupo.length, pixeles: grupo,
    });
  }
  return encontradas;
}

/**
 * Pone nombre a cada mancha por dónde está y qué forma tiene.
 * No se fía del orden en que el modelo las dibujó: se ordena por geometría.
 */
function clasificar(ms, W, H) {
  const centro = (m) => ({ cx: (m.x0 + m.x1) / 2, cy: (m.y0 + m.y1) / 2, w: m.x1 - m.x0 + 1, h: m.y1 - m.y0 + 1 });
  const info = ms.map((m) => ({ m, ...centro(m) }));
  const nombre = {};
  const usadas = new Set();
  const tomar = (lista, clave) => {
    const elegida = lista.find((i) => !usadas.has(i.m));
    if (elegida) { usadas.add(elegida.m); nombre[clave] = elegida; }
    return elegida;
  };
  // La CABEZA: la mancha más alta.
  tomar([...info].sort((a, b) => a.cy - b.cy), 'cabeza');
  // El TORSO: de las que quedan en la mitad superior, la más ancha y centrada.
  tomar([...info].filter((i) => i.cy < H * 0.62).sort((a, b) => (b.w * b.h) - (a.w * a.h)), 'torso');
  // La FALDA: de la mitad inferior, la más ancha.
  tomar([...info].filter((i) => i.cy > H * 0.5).sort((a, b) => b.w - a.w), 'faldon');
  // BRAZOS: las dos restantes más altas, izquierda y derecha.
  const brazos = [...info].filter((i) => !usadas.has(i.m)).sort((a, b) => a.cy - b.cy).slice(0, 2).sort((a, b) => a.cx - b.cx);
  if (brazos[0]) { usadas.add(brazos[0].m); nombre.brazoLejano = brazos[0]; }
  if (brazos[1]) { usadas.add(brazos[1].m); nombre.brazoCercano = brazos[1]; }
  // PIERNAS: las dos que quedan, izquierda y derecha.
  const piernas = [...info].filter((i) => !usadas.has(i.m)).sort((a, b) => b.cy - a.cy).slice(0, 2).sort((a, b) => a.cx - b.cx);
  if (piernas[0]) { usadas.add(piernas[0].m); nombre.piernaIzq = piernas[0]; }
  if (piernas[1]) { usadas.add(piernas[1].m); nombre.piernaDer = piernas[1]; }
  return nombre;
}

/** El punto por el que gira cada pieza, en coordenadas de la propia pieza. */
function pivoteDe(clave, ancho, alto) {
  // Brazos y piernas cuelgan de arriba (hombro, cadera); la cabeza se apoya
  // abajo (cuello); el torso gira sobre la cadera, que es su borde inferior.
  // La CABEZA se apoya por abajo (el cuello) y el TORSO gira sobre su base (la
  // cadera): sus pivotes van en el borde inferior.
  if (clave === 'cabeza' || clave === 'torso') return { x: Math.round(ancho / 2), y: alto - 1 };
  // Todo lo que CUELGA —brazos del hombro, piernas y faldón de la cadera— pivota
  // por su borde superior. Ponerle el pivote abajo al faldón lo hacía colgar
  // hacia arriba y tapar el torso entero.
  return { x: Math.round(ancho / 2), y: 1 };
}

/** Reduce por mayoría de color, como las hojas: sin restos del fondo. */
function reducir(src, W, caja, factor) {
  const w = Math.max(1, Math.round((caja.x1 - caja.x0 + 1) * factor));
  const h = Math.max(1, Math.round((caja.y1 - caja.y0 + 1) * factor));
  const out = new Uint8ClampedArray(w * h * 4);
  const paso = 1 / factor;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = caja.x0 + Math.floor(x * paso), x1 = caja.x0 + Math.max(Math.ceil((x + 1) * paso), Math.floor(x * paso) + 1);
    const y0 = caja.y0 + Math.floor(y * paso), y1 = caja.y0 + Math.max(Math.ceil((y + 1) * paso), Math.floor(y * paso) + 1);
    const votos = new Map(); let macizos = 0, total = 0;
    for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
      total++;
      const i = (sy * W + sx) * 4;
      if (!src[i + 3]) continue;
      macizos++;
      const cubo = ((src[i] >> 3) << 10) | ((src[i + 1] >> 3) << 5) | (src[i + 2] >> 3);
      const v = votos.get(cubo); if (v) v.n++; else votos.set(cubo, { n: 1, i });
    }
    if (!total || macizos / total < 0.45) continue;
    let mejor = null; for (const v of votos.values()) if (!mejor || v.n > mejor.n) mejor = v;
    if (!mejor) continue;
    const d = (y * w + x) * 4;
    out[d] = src[mejor.i]; out[d + 1] = src[mejor.i + 1]; out[d + 2] = src[mejor.i + 2]; out[d + 3] = 255;
  }
  return { px: out, w, h };
}

const sexo = process.argv[2] ?? 'mujer';
const dir = path.join(RAIZ, 'public', 'personajes', sexo, 'despiece');
const vistas = [];

for (let v = 0; v < 4; v++) {
  const ruta = path.join(dir, `vista-${v}.png`);
  if (!await fs.access(ruta).then(() => true).catch(() => false)) { vistas.push(null); continue; }
  const limpio = await sinFondo(ruta);
  const ms = manchas(limpio);
  const clasif = clasificar(ms, limpio.W, limpio.H);
  console.log(`vista ${v}: ${ms.length} piezas → ${Object.keys(clasif).join(', ')}`);

  // La escala: que el personaje montado mida lo de siempre. Se toma de la altura
  // total del despiece (cabeza + torso + pierna), que es la del personaje.
  const alturaDibujo = (clasif.cabeza?.h ?? 0) + (clasif.torso?.h ?? 0) + (clasif.piernaIzq?.h ?? clasif.faldon?.h ?? 0);
  const factor = alturaDibujo ? (ALTO_PERSONAJE * 1.15) / alturaDibujo : 0.2;

  const piezas = {};
  for (const [clave, info] of Object.entries(clasif)) {
    const r = reducir(limpio.data, limpio.W, info.m, factor);
    piezas[clave] = { ...r, pivote: pivoteDe(clave, r.w, r.h) };
  }
  vistas.push(piezas);
}

// Atlas: todas las piezas de todas las vistas en una tira.
let ancho = 0, alto = 0;
for (const p of vistas) if (p) for (const q of Object.values(p)) { ancho += q.w + 1; alto = Math.max(alto, q.h); }
const atlas = new Uint8ClampedArray(ancho * alto * 4);
const meta = { version: 3, alto_personaje: ALTO_PERSONAJE, vistas: [] };
let cursor = 0;
for (const piezas of vistas) {
  if (!piezas) { meta.vistas.push(null); continue; }
  const enVista = {};
  for (const [clave, q] of Object.entries(piezas)) {
    for (let y = 0; y < q.h; y++) for (let x = 0; x < q.w; x++) {
      const i = (y * q.w + x) * 4, j = (y * ancho + cursor + x) * 4;
      atlas[j] = q.px[i]; atlas[j + 1] = q.px[i + 1]; atlas[j + 2] = q.px[i + 2]; atlas[j + 3] = q.px[i + 3];
    }
    enVista[clave] = { region: { x: cursor, y: 0, w: q.w, h: q.h }, pivote: q.pivote };
    cursor += q.w + 1;
  }

  // DÓNDE SE UNE CADA PIEZA. El torso manda: todo lo demás cuelga de él.
  //
  // Se calcula de sus proporciones en vez de escribirse a mano, porque cada
  // prenda da un torso de otro tamaño: una túnica es más ancha que una camisa.
  // Los hombros van un poco por dentro del borde para que la manga solape y no
  // se vea la juntura al girar el brazo.
  const t = enVista.torso;
  if (t) {
    const w = t.region.w, h = t.region.h;
    enVista._union = {
      // Coordenadas locales del TORSO (su origen es su esquina superior izquierda).
      cuello: { x: Math.round(w / 2), y: 1 },
      hombroLejano: { x: Math.round(w * 0.14), y: Math.round(h * 0.14) },
      hombroCercano: { x: Math.round(w * 0.86), y: Math.round(h * 0.14) },
      caderaIzq: { x: Math.round(w * 0.32), y: h - 2 },
      caderaDer: { x: Math.round(w * 0.68), y: h - 2 },
      cadera: { x: Math.round(w / 2), y: h - 2 },
      // La mano, para armas y herramientas: al final del brazo cercano.
      mano: enVista.brazoCercano
        ? { x: Math.round(enVista.brazoCercano.region.w / 2), y: enVista.brazoCercano.region.h - 2 }
        : null,
    };
  }
  meta.vistas.push(enVista);
}

const salidaPng = path.join(RAIZ, 'godot', 'assets', `piezas-${sexo}.png`);
const salidaJson = path.join(RAIZ, 'godot', 'assets', `piezas-${sexo}.json`);
await sharp(Buffer.from(atlas), { raw: { width: ancho, height: alto, channels: 4 } }).png().toFile(salidaPng);
await fs.writeFile(salidaJson, JSON.stringify(meta, null, 2));
console.log(`\n✔ ${path.relative(RAIZ, salidaPng)} (${ancho}×${alto}) + su JSON`);
