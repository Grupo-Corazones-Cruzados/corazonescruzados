#!/usr/bin/env node
/**
 * Generador de piezas del CREADOR DE PERSONAJE (estilo del prólogo).
 * ==================================================================
 *
 * Hermano de `godot/tools/generar_estampas.py`: mismo modelo de Google (AI
 * Studio) y misma idea de "anclar" el estilo con una imagen de referencia. La
 * diferencia es que aquí no se genera una ilustración suelta sino **hojas de
 * sprites**, y eso obliga a un post-proceso que el prólogo no necesita.
 *
 * Va en Node y no en Python porque necesita tratamiento de imagen (recortar el
 * fondo y cuadrar las figuras) y `sharp` ya es dependencia de la app; además el
 * catálogo que produce lo consume el creador, que es TypeScript.
 *
 * USO
 *   node scripts/generar-personaje.mjs base mujer
 *   node scripts/generar-personaje.mjs base hombre
 *   node scripts/generar-personaje.mjs base mujer --forzar    (regenera aunque exista)
 *
 * SALIDA
 *   public/personajes/base/<sexo>.png        hoja normalizada (4 vistas)
 *   public/personajes/base/<sexo>.crudo.png  lo que devolvió el modelo, tal cual
 *   public/personajes/base/<sexo>.txt        el prompt usado, como registro
 *
 * POR QUÉ EL POST-PROCESO (medido el 2026-07-27, no son suposiciones):
 *  1. **El modelo NO devuelve transparencia**: dibuja un cuadriculado gris
 *     imitándola (alfa 255 en toda la imagen). Se quita rellenando desde los
 *     BORDES por color; nunca desde dentro, o se comería los blancos de la ropa.
 *  2. **No es fiel al píxel entre generaciones**: repite postura, escala y
 *     posición, pero con derivas de ±1 px. Por eso NO se pueden extraer capas
 *     restando dos imágenes (sale ruido), y por eso cada figura se **recuadra**
 *     a una rejilla fija alineándola por los pies y por su centro. Con eso las
 *     piezas de distintas generaciones vuelven a encajar.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// --- Configuración ---------------------------------------------------------

const MODELO = 'gemini-3-pro-image';
const RAIZ = process.cwd();
const ANCLA = 'godot/assets/Prologo/escenas/escena_01.png';
/** Recorte de la aldeana dentro de la estampa 01: es la referencia de estilo. */
const ANCLA_RECORTE = { left: 430, top: 300, width: 200, height: 260 };
const SALIDA = 'public/personajes';

/**
 * Rejilla del catálogo: cada vista ocupa una celda de este tamaño.
 *
 * El modelo dibuja a lo grande (la figura sale a ~550 px de alto, con bloques de
 * unos 7 px por "píxel" de arte). Aquí se reduce a una altura fija con vecino
 * más cercano: así el sprite queda a tamaño de juego, los bordes siguen duros y
 * —lo importante— **todas las piezas acaban a la misma escala exacta**, vengan
 * de la tirada que vengan.
 */
const CELDA = { ancho: 96, alto: 128 };
/** Alto al que se lleva TODA figura. Manda sobre lo que haya dibujado el modelo. */
const ALTO_FIGURA = 112;
const VISTAS = ['frente', 'espalda', 'izquierda', 'derecha'];
/** Margen bajo los pies dentro de la celda (deja aire para sombras futuras). */
const MARGEN_PIES = 6;

// --- Llamada al modelo -----------------------------------------------------

async function leerClave() {
  const env = await fs.readFile(path.join(RAIZ, '.env'), 'utf8').catch(() => '');
  const m = env.match(/^GEMINI_API_KEY\s*=\s*"?([^"\n]+)"?/m);
  const clave = process.env.GEMINI_API_KEY || m?.[1];
  if (!clave) {
    throw new Error('Falta GEMINI_API_KEY (en .env o exportada). Se consigue en https://aistudio.google.com/apikey');
  }
  return clave;
}

async function generar(prompt, imagenes) {
  const clave = await leerClave();
  const partes = [{ text: prompt }];
  for (const img of imagenes) {
    partes.push({ inline_data: { mime_type: 'image/png', data: img.toString('base64') } });
  }
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${encodeURIComponent(clave)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: partes }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    },
  );
  const texto = await r.text();
  if (!r.ok) throw new Error(`El modelo respondió ${r.status}: ${texto.slice(0, 400)}`);
  const datos = JSON.parse(texto);
  const salida = datos?.candidates?.[0]?.content?.parts ?? [];
  const imagen = salida.find((p) => p.inlineData || p.inline_data);
  if (!imagen) {
    const dijo = salida.map((p) => p.text).filter(Boolean).join(' ').slice(0, 300);
    throw new Error(`El modelo no devolvió imagen. Dijo: ${dijo || '(nada)'}`);
  }
  return Buffer.from((imagen.inlineData ?? imagen.inline_data).data, 'base64');
}

// --- Post-proceso ----------------------------------------------------------

/** Quita el falso transparente (cuadriculado gris) rellenando desde los bordes. */
async function quitarFondo(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const esFondo = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return r > 214 && g > 214 && b > 214 && Math.max(r, g, b) - Math.min(r, g, b) < 16;
  };
  const visto = new Uint8Array(W * H);
  const pila = [];
  for (let x = 0; x < W; x++) pila.push(x, 0, x, H - 1);
  for (let y = 0; y < H; y++) pila.push(0, y, W - 1, y);
  while (pila.length) {
    const y = pila.pop(), x = pila.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x;
    if (visto[p] || !esFondo(p * 4)) continue;
    visto[p] = 1;
    data[p * 4 + 3] = 0;
    pila.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  return { data, W, H };
}

/**
 * Quita el HALO del contorno.
 *
 * El modelo no dibuja bordes duros: entre la figura y el fondo deja un par de
 * píxeles medio blancos (antialias). El relleno por color no los alcanza —no son
 * blanco puro— y al reducir la imagen quedaban como un punteado blanco alrededor
 * de todo el personaje.
 *
 * Se pelan por capas: en cada pasada se mira solo lo que **toca el vacío** y, si
 * es claro y sin color (blanco sucio), se corta. Dos condiciones, no una: la
 * saturación es la que salva la ropa cruda (216,207,175 es clara, pero tiene
 * color de sobra), mientras que el halo es gris neutro.
 */
function quitarHalo({ data, W, H }, pasadas = 4) {
  const luz = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  const color = (i) => Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
  let total = 0;
  for (let p = 0; p < pasadas; p++) {
    const sobran = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (data[i + 3] === 0) continue;
        const tocaVacio =
          (x > 0 && data[(y * W + x - 1) * 4 + 3] === 0) ||
          (x < W - 1 && data[(y * W + x + 1) * 4 + 3] === 0) ||
          (y > 0 && data[((y - 1) * W + x) * 4 + 3] === 0) ||
          (y < H - 1 && data[((y + 1) * W + x) * 4 + 3] === 0);
        if (!tocaVacio) continue;
        // Umbrales medidos sobre las hojas reales, no a ojo: los restos de halo
        // salen con saturación 6–13 y luz 171–193; el píxel de ARTE más neutro
        // (la camisa cruda) tiene saturación 49. Queda margen de sobra entre
        // ambos, así que se corta por saturación y se es generoso con la luz.
        if (luz(i) > 165 && color(i) < 32) sobran.push(i);
      }
    }
    if (!sobran.length) break;
    for (const i of sobran) data[i + 3] = 0;
    total += sobran.length;
  }
  return total;
}

/** Separa las figuras por los huecos verticales y devuelve su caja. */
function localizarFiguras({ data, W, H }) {
  const solido = (x, y) => data[(y * W + x) * 4 + 3] > 60;
  const columnas = new Array(W).fill(0);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (solido(x, y)) columnas[x]++;
  // Un par de píxeles sueltos son ruido del recorte, no una figura.
  const cajas = [];
  let inicio = -1;
  for (let x = 0; x <= W; x++) {
    const hay = x < W && columnas[x] > 3;
    if (hay && inicio < 0) inicio = x;
    if (!hay && inicio >= 0) {
      if (x - inicio > 16) {
        let y0 = H, y1 = -1;
        for (let xi = inicio; xi < x; xi++) for (let y = 0; y < H; y++) if (solido(xi, y)) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
        cajas.push({ x0: inicio, x1: x - 1, y0, y1 });
      }
      inicio = -1;
    }
  }
  return cajas;
}

/**
 * Recuadra las figuras en una tira de celdas iguales, **alineadas por los pies y
 * por el centro**. Es el paso que corrige la deriva de ±1 px del modelo y hace
 * que piezas de generaciones distintas encajen entre sí.
 */
async function normalizar(limpio, nombre) {
  const cajas = localizarFiguras(limpio);
  if (cajas.length !== VISTAS.length) {
    console.warn(`  ⚠ se esperaban ${VISTAS.length} vistas y se encontraron ${cajas.length}: se guarda el crudo para revisarlo a mano`);
  }
  const { data, W, H } = limpio;
  const origen = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();

  const lienzo = sharp({
    create: { width: CELDA.ancho * VISTAS.length, height: CELDA.alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });

  // Todas las figuras se reducen por el MISMO factor —el que lleva a la más alta
  // a `ALTO_FIGURA`—, no cada una por el suyo: si no, una vista con el pelo más
  // alto saldría más pequeña que las demás y el personaje "encogería" al girar.
  const altoMayor = Math.max(...cajas.map((c) => c.y1 - c.y0 + 1));
  const factor = ALTO_FIGURA / altoMayor;

  const capas = [];
  for (let i = 0; i < Math.min(cajas.length, VISTAS.length); i++) {
    const c = cajas[i];
    const ancho = c.x1 - c.x0 + 1;
    const alto = c.y1 - c.y0 + 1;
    const anchoFinal = Math.max(1, Math.round(ancho * factor));
    const altoFinal = Math.max(1, Math.round(alto * factor));
    const recorte = await sharp(origen)
      .extract({ left: c.x0, top: c.y0, width: ancho, height: alto })
      // `nearest`: reducir con interpolación suave emborrona el pixel art.
      .resize({ width: anchoFinal, height: altoFinal, kernel: 'nearest' })
      .toBuffer();
    if (anchoFinal > CELDA.ancho) {
      console.warn(`  ⚠ la vista "${VISTAS[i]}" es más ancha (${anchoFinal}) que la celda (${CELDA.ancho})`);
      continue;
    }
    // Centrada en su celda y apoyada sobre la misma línea de suelo.
    capas.push({
      input: recorte,
      left: i * CELDA.ancho + Math.round((CELDA.ancho - anchoFinal) / 2),
      top: CELDA.alto - MARGEN_PIES - altoFinal,
    });
  }
  const png = await lienzo.composite(capas).png().toBuffer();

  // Segunda pasada de halo, ya sobre la hoja REDUCIDA. Hace falta porque al
  // reducir con vecino más cercano se toma un píxel de cada bloque: un resto
  // blanco de 1 px que arriba era invisible puede convertirse aquí en un píxel
  // de arte entero (se veía como puntitos en la coronilla y en el pelo).
  const chico = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pelados = quitarHalo({ data: chico.data, W: chico.info.width, H: chico.info.height });
  const hojaLimpia = await sharp(chico.data, {
    raw: { width: chico.info.width, height: chico.info.height, channels: 4 },
  }).png().toBuffer();

  console.log(`  ${nombre}: ${cajas.length} vistas → rejilla de ${VISTAS.length}×${CELDA.ancho}×${CELDA.alto} · ${pelados} px de halo tras reducir`);
  return hojaLimpia;
}

// --- Prompts ---------------------------------------------------------------

const RASGOS_COMUNES = `Estilo: EXACTAMENTE el mismo pixel art de la imagen de referencia (misma paleta cálida y apagada, mismo tamaño de píxel grueso, mismo contorno oscuro, mismo sombreado plano, sin degradados ni brillos).

Personaje: adolescente de 17 años, complexión normal, de cuerpo entero, de pie, brazos relajados a los lados, SIN objetos en las manos.

Composición: las cuatro vistas en UNA SOLA FILA, separadas por espacio vacío, TODAS del mismo alto y con los pies exactamente sobre la misma línea de suelo:
1) de frente  2) de espaldas  3) de perfil hacia la izquierda  4) de perfil hacia la derecha

Fondo completamente vacío y liso, sin hierba, sin sombra proyectada, sin marco, sin texto, sin cuadrícula y sin ningún otro elemento.`;

const BASES = {
  mujer: `Hoja de sprites de una CHICA adolescente para un videojuego 2D.

${RASGOS_COMUNES}

Ropa: prendas base sencillas y neutras (camisa de manga larga color crudo y falda larga marrón sencilla, zapatos oscuros bajos). Pelo castaño corto, SIN pañuelo, SIN gorro y SIN accesorios en la cabeza. Sin delantal, sin cesta, sin bolsas.`,

  hombre: `Hoja de sprites de un CHICO adolescente para un videojuego 2D.

${RASGOS_COMUNES}

Ropa: prendas base sencillas y neutras (camisa de manga larga color crudo y pantalón largo marrón sencillo, zapatos oscuros bajos). Pelo castaño corto, SIN barba, SIN gorro y SIN accesorios en la cabeza. Sin capa, sin mochila, sin objetos.`,
};

// --- Programa --------------------------------------------------------------

async function main() {
  const [pieza, variante] = process.argv.slice(2);
  const forzar = process.argv.includes('--forzar');

  if (pieza !== 'base' || !BASES[variante]) {
    console.error('Uso: node scripts/generar-personaje.mjs base <hombre|mujer> [--forzar]');
    process.exit(1);
  }

  const destino = path.join(RAIZ, SALIDA, 'base');
  await fs.mkdir(destino, { recursive: true });
  const final = path.join(destino, `${variante}.png`);
  if (!forzar && await fs.access(final).then(() => true).catch(() => false)) {
    console.log(`Ya existe ${final} (usa --forzar para regenerarlo).`);
    return;
  }

  // `--reprocesar`: vuelve a recortar y cuadrar la ÚLTIMA tirada guardada, sin
  // llamar al modelo. Sirve para afinar el post-proceso sin gastar generaciones.
  let crudo;
  const crudoPath = path.join(destino, `${variante}.crudo.png`);
  if (process.argv.includes('--reprocesar')) {
    crudo = await fs.readFile(crudoPath);
    console.log(`▸ Reprocesando la tirada guardada (${crudoPath}), sin llamar al modelo`);
  } else {
    console.log(`▸ Anclando el estilo en ${ANCLA}`);
    const ancla = await sharp(path.join(RAIZ, ANCLA))
      .extract(ANCLA_RECORTE)
      .resize({ width: 600, kernel: 'nearest' })
      .png()
      .toBuffer();

    console.log(`▸ Generando la base "${variante}" con ${MODELO}…`);
    const t0 = Date.now();
    crudo = await generar(BASES[variante], [ancla]);
    console.log(`  el modelo respondió en ${((Date.now() - t0) / 1000).toFixed(1)} s`);

    await fs.writeFile(crudoPath, crudo);
    await fs.writeFile(path.join(destino, `${variante}.txt`), BASES[variante]);
  }

  console.log('▸ Quitando el falso transparente y cuadrando las vistas…');
  const limpio = await quitarFondo(crudo);
  const pelados = quitarHalo(limpio);
  console.log(`  halo del contorno: ${pelados} píxeles retirados`);
  const hoja = await normalizar(limpio, variante);
  await fs.writeFile(final, hoja);

  console.log(`\n✔ ${final}`);
  console.log('  Revísala. Si el estilo no convence, vuelve a lanzar con --forzar: cada tirada es distinta.');
}

main().catch((e) => {
  console.error('✖', e.message);
  process.exit(1);
});
