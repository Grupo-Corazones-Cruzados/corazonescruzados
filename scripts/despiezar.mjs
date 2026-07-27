#!/usr/bin/env node
/**
 * Pide al modelo el personaje DESPIEZADO, como las piezas de una marioneta.
 * =========================================================================
 *
 * Por qué esto y no recortar la hoja compuesta: en un dibujo plano el brazo no
 * existe como pieza, son unos píxeles pegados al torso. Al recortarlo salen
 * manos flotando y el hombro se abre al girar. Una pieza pensada para articular
 * se dibuja ENTERA, con el extremo redondeado y material de sobra en la unión.
 *
 * Es como están hechos los personajes de Guardian Tales, y es lo que permite
 * que un casco o una armadura se dibujen UNA vez y valgan para toda animación.
 *
 *   node scripts/despiezar.mjs mujer            (las 4 vistas)
 *   node scripts/despiezar.mjs mujer 0 --forzar (solo la de frente)
 *
 * SALIDA  public/personajes/<sexo>/despiece/vista-<n>.png
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const RAIZ = process.cwd();
const MODELO = 'gemini-3-pro-image';
const VISTAS = ['de frente', 'de espaldas', 'de perfil mirando a la izquierda', 'de perfil mirando a la derecha'];

async function clave() {
  const env = await fs.readFile(path.join(RAIZ, '.env'), 'utf8').catch(() => '');
  const m = env.match(/^GEMINI_API_KEY\s*=\s*"?([^"\n]+)"?/m);
  const k = process.env.GEMINI_API_KEY || m?.[1];
  if (!k) throw new Error('Falta GEMINI_API_KEY');
  return k;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(prompt, imagen, intentos = 5) {
  for (let n = 1; ; n++) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${encodeURIComponent(await clave())}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/png', data: imagen.toString('base64') } }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      });
      const t = await r.text();
      if (!r.ok) throw new Error(`${r.status}: ${t.slice(0, 200)}`);
      const partes = JSON.parse(t)?.candidates?.[0]?.content?.parts ?? [];
      const img = partes.find((p) => p.inlineData || p.inline_data);
      if (!img) throw new Error('sin imagen');
      return Buffer.from((img.inlineData ?? img.inline_data).data, 'base64');
    } catch (e) {
      const pasajero = /\b(429|500|502|503|504)\b|fetch failed|sin imagen/i.test(e.message);
      if (!pasajero || n >= intentos) throw e;
      const pausa = 15000 * 2 ** (n - 1);
      console.log(`   saturado; reintento ${n} en ${pausa / 1000}s…`);
      await espera(pausa);
    }
  }
}

function prompt(vista) {
  const perfil = vista >= 2;
  return `Despieza a este personaje en las piezas de una MARIONETA articulada, para animarlo con huesos.

El personaje está ${VISTAS[vista]}. Dibuja SUS piezas ${VISTAS[vista]}, separadas y sin tocarse, repartidas por el lienzo, todas del mismo personaje y en el mismo estilo pixel art de la referencia (misma paleta, mismo grosor de píxel, mismo contorno oscuro):

1) la cabeza con el cuello
2) el torso SIN brazos ni cabeza
3) ${perfil ? 'el brazo visible entero, del hombro a la mano' : 'el brazo derecho entero, del hombro a la mano'}
4) ${perfil ? 'el otro brazo, el del lado oculto, también entero' : 'el brazo izquierdo entero'}
5) ${perfil ? 'la pierna visible entera, de la cadera al pie' : 'la pierna derecha entera, de la cadera al pie'}
6) ${perfil ? 'la otra pierna, entera' : 'la pierna izquierda entera'}
7) la falda como pieza suelta

MUY IMPORTANTE: cada pieza COMPLETA y CERRADA, con el extremo de articulación REDONDEADO —el hombro, la cadera— y con material de sobra en la unión, porque van a girar. No dibujes el personaje montado. Sin líneas, sin marcos, sin texto, sin etiquetas, sin cuadrícula. Fondo blanco liso.`;
}

const [sexo, vistaArg] = process.argv.slice(2);
const forzar = process.argv.includes('--forzar');
if (!['mujer', 'hombre'].includes(sexo)) {
  console.error('Uso: node scripts/despiezar.mjs <mujer|hombre> [vista 0-3] [--forzar]');
  process.exit(1);
}
const vistas = vistaArg && vistaArg !== '--forzar' ? [Number(vistaArg)] : [0, 1, 2, 3];
const destino = path.join(RAIZ, 'public', 'personajes', sexo, 'despiece');
await fs.mkdir(destino, { recursive: true });

for (const v of vistas) {
  const salida = path.join(destino, `vista-${v}.png`);
  if (!forzar && await fs.access(salida).then(() => true).catch(() => false)) {
    console.log(`= vista ${v}: ya existe`);
    continue;
  }
  // Referencia: ESA vista del personaje ya compuesto, ampliada.
  const ref = await sharp(path.join(RAIZ, 'godot', 'assets', 'personaje-prueba.png'))
    .extract({ left: v * 96, top: 0, width: 96, height: 128 })
    .resize({ width: 480, kernel: 'nearest' }).png().toBuffer();
  console.log(`▸ vista ${v} (${VISTAS[v]})…`);
  const t0 = Date.now();
  const png = await pedir(prompt(v), ref);
  await fs.writeFile(salida, png);
  console.log(`  ✔ ${path.relative(RAIZ, salida)}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
