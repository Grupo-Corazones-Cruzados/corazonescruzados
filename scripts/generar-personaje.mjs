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
 *  2. **Tampoco dibuja bordes duros**: deja 1–2 px de mezcla entre la figura y el
 *     fondo. Esa mezcla no es solo blanca —el contorno oscuro mezclado con blanco
 *     da GRISES MEDIOS (77,67,66 · 135,125,123)—, así que ningún umbral de brillo
 *     la distingue del arte. Se resuelve en dos frentes: reducir **por mayoría de
 *     color** en vez de muestrear un píxel, y admitir solo colores de la **paleta
 *     real** del dibujo (la del interior, donde no puede haber mezcla).
 *  3. **No es fiel al píxel entre generaciones**: repite postura, escala y
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
 * unos 5 px por "píxel" de arte). Aquí se reduce a una altura fija **por mayoría
 * de color** (ver `reducirPorMayoria`): así el sprite queda a tamaño de juego,
 * los bordes salen duros y sin restos del fondo, y —lo importante— **todas las
 * piezas acaban a la misma escala exacta**, vengan de la tirada que vengan.
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

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Llama al modelo, reintentando cuando está saturado.
 *
 * `gemini-3-pro-image` devuelve 503 con cierta frecuencia ("high demand"), y una
 * tanda de catorce prendas se topa con ello casi seguro. Se espera cada vez más
 * (15 s, 30 s, 60 s…) para no insistir sobre un servicio que ya va justo.
 */
async function generar(prompt, imagenes, intentos = 5) {
  for (let n = 1; ; n++) {
    try {
      return await pedirImagen(prompt, imagenes);
    } catch (e) {
      // Además de la saturación, se reintenta la caída de red: la petición lleva
      // la plantilla entera (cientos de KB) y a veces se corta por el camino.
      const pasajero = /\b(429|500|502|503|504)\b|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(e.message);
      if (!pasajero || n >= intentos) throw e;
      const pausa = 15000 * 2 ** (n - 1);
      console.log(`  el modelo está saturado; reintento ${n}/${intentos - 1} en ${pausa / 1000} s…`);
      await espera(pausa);
    }
  }
}

async function pedirImagen(prompt, imagenes) {
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

/**
 * La paleta REAL del dibujo: los colores que el personaje usa de verdad.
 * ---------------------------------------------------------------------
 * Se toma solo del INTERIOR de la figura —píxeles que no tocan el vacío ni de
 * lejos—, porque ahí no puede haber mezcla con el fondo. Todo lo que aparezca
 * únicamente en el borde es, por definición, contaminación del blanco.
 *
 * Hace falta porque los restos que sobrevivían no eran claros, sino **grises
 * medios**: la mezcla del contorno oscuro con el fondo blanco (77,67,66 ·
 * 135,125,123). Ningún umbral de brillo los distingue del arte; su paleta, sí.
 */
function paletaReal(data, W, H, margen = 2) {
  const vacio = (x, y) => x < 0 || y < 0 || x >= W || y >= H || data[(y * W + x) * 4 + 3] === 0;
  const cuenta = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] === 0) continue;
      let cerca = false;
      for (let dy = -margen; dy <= margen && !cerca; dy++) {
        for (let dx = -margen; dx <= margen; dx++) {
          if (vacio(x + dx, y + dy)) { cerca = true; break; }
        }
      }
      if (cerca) continue; // borde: no vota para la paleta
      const cubo = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
      cuenta.set(cubo, (cuenta.get(cubo) ?? 0) + 1);
    }
  }
  // Un color que sale cuatro veces en toda la figura es ruido, no paleta.
  const paleta = new Set();
  for (const [cubo, n] of cuenta) if (n >= 5) paleta.add(cubo);
  return paleta;
}

/**
 * Reduce una figura por MAYORÍA, no por muestreo.
 * ------------------------------------------------
 * Aquí está la clave de que no queden restos de fondo. El modelo dibuja cada
 * píxel de arte como un bloque de varios píxeles reales, y entre la figura y el
 * fondo deja un borde suavizado de 1–2 px. Si al reducir se toma **un** píxel de
 * cada bloque (que es lo que hace `nearest`), tarde o temprano se toma uno del
 * borde y ese píxel entra en el sprite ya mezclado con blanco: son los rastros
 * que se veían.
 *
 * Reduciendo por mayoría el problema desaparece **por construcción**: dentro de
 * cada bloque el suavizado es siempre minoría frente al color macizo, así que
 * nunca gana. Y un bloque que es mayoritariamente fondo se queda transparente
 * entero, en vez de dejar flecos.
 *
 * Los colores se agrupan en cubos de 8 para contar (dos tonos casi iguales del
 * mismo marrón deben sumar juntos), pero se devuelve un color REAL de la imagen,
 * no el promedio: promediar inventa tonos que no están en la paleta.
 */
function reducirPorMayoria(data, W, caja, factor, anchoDestino, altoDestino, paleta) {
  const salida = Buffer.alloc(anchoDestino * altoDestino * 4, 0);
  for (let oy = 0; oy < altoDestino; oy++) {
    for (let ox = 0; ox < anchoDestino; ox++) {
      const x0 = caja.x0 + Math.floor(ox * factor);
      const x1 = caja.x0 + Math.max(Math.ceil((ox + 1) * factor), Math.floor(ox * factor) + 1);
      const y0 = caja.y0 + Math.floor(oy * factor);
      const y1 = caja.y0 + Math.max(Math.ceil((oy + 1) * factor), Math.floor(oy * factor) + 1);

      const votos = new Map();
      let macizos = 0;
      let total = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          total++;
          const i = (y * W + x) * 4;
          if (data[i + 3] === 0) continue; // fondo ya recortado
          const cubo = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
          // Solo votan los colores de la paleta real: una mezcla con el fondo
          // no puede ganar un bloque ni aunque sea mayoría en él.
          if (!paleta.has(cubo)) continue;
          macizos++;
          const v = votos.get(cubo);
          if (v) v.n++;
          else votos.set(cubo, { n: 1, i });
        }
      }

      // Un bloque que apenas toca la figura es fondo: transparente entero. El
      // 45 % deja el contorno donde lo pondría un dibujante, sin comerse la
      // silueta ni dejar flecos.
      if (!total || macizos / total < 0.45) continue;

      let mejor = null;
      for (const v of votos.values()) if (!mejor || v.n > mejor.n) mejor = v;
      if (!mejor) continue;

      const d = (oy * anchoDestino + ox) * 4;
      salida[d] = data[mejor.i];
      salida[d + 1] = data[mejor.i + 1];
      salida[d + 2] = data[mejor.i + 2];
      salida[d + 3] = 255; // alfa binario: en pixel art no hay medias tintas
    }
  }
  return salida;
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
  const lienzo = sharp({
    create: { width: CELDA.ancho * VISTAS.length, height: CELDA.alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });

  // Todas las figuras se reducen por el MISMO factor —el que lleva a la más alta
  // a `ALTO_FIGURA`—, no cada una por el suyo: si no, una vista con el pelo más
  // alto saldría más pequeña que las demás y el personaje "encogería" al girar.
  const altoMayor = Math.max(...cajas.map((c) => c.y1 - c.y0 + 1));
  const factor = ALTO_FIGURA / altoMayor;

  // Paleta del dibujo, tomada del interior: lo que no esté aquí es mezcla con
  // el fondo y no puede acabar en el sprite.
  const paleta = paletaReal(limpio.data, limpio.W, limpio.H);
  console.log(`  paleta real: ${paleta.size} colores`);

  const capas = [];
  for (let i = 0; i < Math.min(cajas.length, VISTAS.length); i++) {
    const c = cajas[i];
    const ancho = c.x1 - c.x0 + 1;
    const alto = c.y1 - c.y0 + 1;
    const anchoFinal = Math.max(1, Math.round(ancho * factor));
    const altoFinal = Math.max(1, Math.round(alto * factor));
    // Reducción por mayoría (NO `nearest`): es lo que impide que el borde
    // suavizado del modelo se cuele en el sprite. Ver `reducirPorMayoria`.
    const crudoReducido = reducirPorMayoria(
      limpio.data, limpio.W, c, 1 / factor, anchoFinal, altoFinal, paleta,
    );
    const recorte = await sharp(crudoReducido, {
      raw: { width: anchoFinal, height: altoFinal, channels: 4 },
    }).png().toBuffer();
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

/**
 * Prendas: se generan EDITANDO la plantilla, nunca desde cero.
 *
 * La entrada es la tirada original de la base (`<sexo>.crudo.png`), no la hoja
 * reducida: al modelo hay que darle la imagen grande o pierde detalle. Se le
 * pide cambiar una sola prenda y no tocar nada más; luego pasa por el mismo
 * post-proceso, así la pieza cae en la misma rejilla que la base.
 */
function promptPrenda(parte, descripcion) {
  const zona = parte === 'superior'
    ? 'la prenda de la MITAD SUPERIOR del cuerpo (del cuello a la cintura)'
    : 'la prenda de la MITAD INFERIOR del cuerpo (de la cintura a los pies, calzado incluido)';
  const intacto = parte === 'superior'
    ? 'la cara, el peinado, los brazos, las manos, la falda o el pantalón y el calzado'
    : 'la cara, el peinado, los brazos, las manos y la prenda de arriba';

  return `Toma esta hoja de sprites y cambia UNA SOLA COSA: ${zona}, que pasa a ser ${descripcion}.

TODO LO DEMÁS QUEDA EXACTAMENTE IGUAL: ${intacto}. No muevas ni redibujes las figuras, no cambies su tamaño ni su postura, no cambies la línea de suelo, no cambies el fondo. Mantén el mismo estilo pixel art, el mismo grosor de píxel y el mismo contorno oscuro.

Las cuatro vistas (frente, espalda y los dos perfiles) deben llevar la prenda nueva, coherente entre ellas.`;
}

/**
 * Piezas de la CABEZA: peinado, vello facial y accesorios.
 *
 * Se generan igual que las prendas —editando la plantilla— pero se recortan por
 * la banda de la cabeza (`CUELLO`), no por la cintura. Limitación conocida: un
 * peinado largo que caiga sobre los hombros se saldría de esa banda, así que
 * esta tanda se queda en cortes que no pasan del cuello.
 */
function promptCabeza(descripcion) {
  return `Toma esta hoja de sprites y cambia UNA SOLA COSA: ${descripcion}.

TODO LO DEMÁS QUEDA EXACTAMENTE IGUAL: la cara, el cuerpo, la ropa, los brazos, las manos y el calzado. No muevas ni redibujes las figuras, no cambies su tamaño ni su postura, no cambies la línea de suelo, no cambies el fondo. Mantén el mismo estilo pixel art, el mismo grosor de píxel y el mismo contorno oscuro.

Las cuatro vistas (frente, espalda y los dos perfiles) deben ser coherentes entre ellas.`;
}

const CABEZA = {
  mujer: {
    pelo: {
      'melena-corta': 'el peinado pasa a ser una melena corta y lisa a la altura de la mandíbula',
      'recogido': 'el peinado pasa a ser el pelo recogido en un moño bajo, con la frente despejada',
      'trenza-corta': 'el peinado pasa a ser el pelo recogido en una trenza corta pegada a la cabeza',
    },
    tocado: {
      'panuelo-verde': 'se le añade un pañuelo de tela verde oliva atado a la cabeza, que cubre el pelo como el de una aldeana',
      'capucha-parda': 'se le añade una capucha de lana parda puesta sobre la cabeza',
    },
  },
  hombre: {
    pelo: {
      'corto-revuelto': 'el peinado pasa a ser el pelo corto y revuelto',
      'rapado': 'el peinado pasa a ser el pelo muy corto, casi rapado',
      'flequillo': 'el peinado pasa a ser el pelo corto con flequillo sobre la frente',
    },
    barba: {
      'sin-barba': 'la cara queda completamente afeitada, sin nada de vello facial',
      'incipiente': 'se le añade barba incipiente, muy corta, apenas una sombra en la mandíbula',
    },
    tocado: {
      'gorra-parda': 'se le añade una gorra de tela parda puesta en la cabeza',
      'capucha-parda': 'se le añade una capucha de lana parda puesta sobre la cabeza',
    },
  },
};

/** Primera tanda rústica. Ampliable: añadir aquí y volver a lanzar el script. */
const PRENDAS = {
  mujer: {
    superior: {
      'blusa-cruda': 'una blusa sencilla de lino crudo, manga larga, cuello redondo',
      'blusa-verde': 'una blusa de lino verde oliva apagado, manga larga, con cordón en el cuello',
      'corpino-marron': 'un corpiño marrón sobre camisa clara de manga larga',
      'chal-granate': 'una camisa clara con un chal de lana granate sobre los hombros',
    },
    inferior: {
      'falda-marron': 'una falda larga de lana marrón y zapatos oscuros bajos',
      'falda-ocre': 'una falda larga ocre con remiendos y zapatos oscuros bajos',
      'falda-delantal': 'una falda marrón con delantal de lino crudo y zapatos oscuros bajos',
    },
  },
  hombre: {
    superior: {
      'camisa-cruda': 'una camisa sencilla de lino crudo, manga larga, cuello abierto',
      'camisa-verde': 'una camisa de lino verde oliva apagado, manga larga, remangada',
      'chaleco-cuero': 'un chaleco de cuero marrón sobre camisa clara de manga larga',
      'tunica-parda': 'una túnica parda de lana ceñida con un cinturón de cuero',
    },
    inferior: {
      'pantalon-marron': 'un pantalón largo de lana marrón y botas oscuras bajas',
      'pantalon-gris': 'un pantalón largo de lana gris pardo y botas oscuras bajas',
      'pantalon-remendado': 'un pantalón largo marrón con remiendos y botas oscuras gastadas',
    },
  },
};

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
  const [pieza, sexo, parte, id] = process.argv.slice(2);
  const forzar = process.argv.includes('--forzar');
  const reprocesar = process.argv.includes('--reprocesar');

  const ayuda = () => {
    console.error('Uso:');
    console.error('  node scripts/generar-personaje.mjs base <hombre|mujer> [--forzar] [--reprocesar]');
    console.error('  node scripts/generar-personaje.mjs prenda <hombre|mujer> <superior|inferior> [id|--todas]');
    console.error('  node scripts/generar-personaje.mjs cabeza <hombre|mujer> <pelo|barba|tocado> [id|--todas]');
    console.error('');
    for (const s of Object.keys(PRENDAS)) {
      for (const p of Object.keys(PRENDAS[s])) {
        console.error(`  ${s} ${p}: ${Object.keys(PRENDAS[s][p]).join(', ')}`);
      }
    }
    process.exit(1);
  };

  if (pieza === 'base') {
    if (!BASES[sexo]) ayuda();
    await generarPieza({
      carpeta: path.join(SALIDA, 'base'),
      nombre: sexo,
      prompt: BASES[sexo],
      entradas: async () => [
        await sharp(path.join(RAIZ, ANCLA)).extract(ANCLA_RECORTE).resize({ width: 600, kernel: 'nearest' }).png().toBuffer(),
      ],
      forzar, reprocesar,
    });
    return;
  }

  if (pieza === 'cabeza') {
    const catalogo = CABEZA[sexo]?.[parte];
    if (!catalogo) ayuda();
    const ids = (id === '--todas' || !id) ? Object.keys(catalogo) : [id];
    for (const uno of ids) {
      if (!catalogo[uno]) { console.error(`✖ no existe "${uno}"`); continue; }
      const plantilla = path.join(RAIZ, SALIDA, 'base', `${sexo}.crudo.png`);
      await generarPieza({
        carpeta: path.join(SALIDA, sexo, parte),
        nombre: uno,
        prompt: promptCabeza(catalogo[uno]),
        entradas: async () => [await fs.readFile(plantilla)],
        forzar, reprocesar,
      });
    }
    return;
  }

  if (pieza === 'prenda') {
    const catalogo = PRENDAS[sexo]?.[parte];
    if (!catalogo) ayuda();
    const ids = (id === '--todas' || !id) ? Object.keys(catalogo) : [id];
    for (const uno of ids) {
      if (!catalogo[uno]) { console.error(`✖ no existe la prenda "${uno}"`); continue; }
      // La plantilla es la tirada ORIGINAL de la base (grande): al modelo hay que
      // darle la imagen con detalle, no la hoja ya reducida.
      const plantilla = path.join(RAIZ, SALIDA, 'base', `${sexo}.crudo.png`);
      await generarPieza({
        carpeta: path.join(SALIDA, sexo, parte),
        nombre: uno,
        prompt: promptPrenda(parte, catalogo[uno]),
        entradas: async () => [await fs.readFile(plantilla)],
        forzar, reprocesar,
      });
    }
    return;
  }

  ayuda();
}

/** Genera (o reprocesa) una pieza y la deja cuadrada en la rejilla del catálogo. */
async function generarPieza({ carpeta, nombre, prompt, entradas, forzar, reprocesar }) {
  const destino = path.join(RAIZ, carpeta);
  await fs.mkdir(destino, { recursive: true });
  const final = path.join(destino, `${nombre}.png`);
  const crudoPath = path.join(destino, `${nombre}.crudo.png`);

  if (!forzar && !reprocesar && await fs.access(final).then(() => true).catch(() => false)) {
    console.log(`= ${nombre}: ya existe (usa --forzar para regenerarla)`);
    return;
  }

  console.log(`\n▸ ${carpeta}/${nombre}`);
  let crudo;
  if (reprocesar) {
    crudo = await fs.readFile(crudoPath);
    console.log('  reprocesando la tirada guardada, sin llamar al modelo');
  } else {
    const t0 = Date.now();
    crudo = await generar(prompt, await entradas());
    console.log(`  el modelo respondió en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    await fs.writeFile(crudoPath, crudo);
    await fs.writeFile(path.join(destino, `${nombre}.txt`), prompt);
  }

  const limpio = await quitarFondo(crudo);
  const pelados = quitarHalo(limpio);
  const hoja = await normalizar(limpio, nombre);
  await fs.writeFile(final, hoja);
  console.log(`  ✔ ${final} (halo: ${pelados} px)`);
}

main().catch((e) => {
  console.error('✖', e.message);
  process.exit(1);
});
