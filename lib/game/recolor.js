/**
 * Recoloreado del personaje: pelo y piel, sin gastar generaciones.
 *
 * Lo usa el probador y lo usará el creador. Cada regla salió de un fallo real
 * y de medir la plantilla; los comentarios dicen cuál.
 */
export const ANCHO = 96, ALTO = 128, CUELLO = 42, CINTURA = 80;

// --- Recoloreado por código (sin gastar generaciones) --------------------
//
// Dos decisiones que vienen de MEDIR, no de suponer:
//
// 1. QUÉ ES PIEL Y QUÉ ES ROPA. La piel de la plantilla está en luz 153–159 con
//    r−b ≈ 130; la túnica parda, en luz 95–107 con r−b ≈ 70. Un umbral flojo
//    (r−b>70) metía la ropa dentro de "piel" y la manchaba al recolorear. Se
//    usa un umbral ESTRICTO para sembrar y luego se **crece por vecindad**:
//    así entran los brillos y las sombras de la propia piel —que sueltos se
//    quedaban fuera y salían como puntitos— y no entra la ropa, que ni pasa el
//    umbral flojo ni toca la cara.
//
// 2. CÓMO SE TIÑE. Antes se rotaba el tono y se multiplicaba el brillo, y eso
//    revienta en los extremos (el rubio salía plano). Ahora cada color es una
//    RAMPA de cuatro tonos, de sombra a luz, y cada píxel se coloca en la rampa
//    según su posición relativa dentro de su propia mancha. Es lo que haría un
//    dibujante: cambiar la paleta, no empujar el color.

export const RAMPA_PELO = {
  castano:   null, // el original
  negro:     ['#15100E', '#2A211D', '#413430', '#5C4B45'],
  rubio:     ['#3A2A10', '#6E5320', '#A88437', '#D9B96A'],
  pelirrojo: ['#2E1208', '#6B2A12', '#A24D25', '#C97F4E'],
  ceniza:    ['#2B2830', '#4E4B57', '#7B7885', '#ADAAB5'],
  caoba:     ['#26100C', '#54241A', '#7E3E28', '#A76348'],
};
export const RAMPA_PIEL = {
  clara:   ['#6B4530', '#B07A55', '#E0AE83', '#F2D2AE'],
  media:   null, // el original
  tostada: ['#4E2C1C', '#8A5533', '#B87A4C', '#D49E70'],
  morena:  ['#3A1F13', '#6B3E24', '#94603A', '#B0805A'],
  oscura:  ['#25130B', '#48291A', '#68432B', '#855F42'],
};

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const luzDe = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Color de la rampa en la posición t (0 = sombra, 1 = luz), interpolando. */
function enRampa(rampa, t) {
  const p = Math.max(0, Math.min(0.9999, t)) * (rampa.length - 1);
  const i = Math.floor(p), f = p - i;
  const a = hex(rampa[i]), b = hex(rampa[Math.min(i + 1, rampa.length - 1)]);
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/**
 * Marca los píxeles de una mancha: se siembra con un criterio estricto y se
 * crece por vecindad con uno flojo. La vecindad es la clave — la ropa parda
 * no toca la cara, así que nunca entra por mucho que se parezca de color.
 */
function manchaPorVecindad(d, W, H, estricto, flojo, frontera, veto, alcance = Infinity) {
  // `alcance` limita cuántos píxeles puede alejarse el crecimiento de su
  // semilla. Sin él, la mancha de piel viajaba de la cara al cuello, del
  // cuello al chal granate —que también es cálido— y de ahí a la falda entera.
  // La piel viene en manchas compactas; una prenda, no.
  const marca = new Uint8Array(W * H);
  const paso = new Int16Array(W * H).fill(-1);
  const pila = [];
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (frontera && frontera[p]) continue;
    if (d[i + 3] && estricto(d[i], d[i + 1], d[i + 2], Math.floor(p / W))) { marca[p] = 1; paso[p] = 0; pila.push(p); }
  }
  while (pila.length) {
    const p = pila.shift(), x = p % W, y = (p - x) / W;
    if (paso[p] >= alcance) continue;
    const vecinos = [];
    if (x > 0) vecinos.push(p - 1);
    if (x < W - 1) vecinos.push(p + 1);
    if (y > 0) vecinos.push(p - W);
    if (y < H - 1) vecinos.push(p + W);
    for (const q of vecinos) {
      if (marca[q] || (frontera && frontera[q])) continue;
      const i = q * 4;
      if (!d[i + 3]) continue;
      if (veto && veto(q)) continue;
      if (flojo(d[i], d[i + 1], d[i + 2], Math.floor(q / W))) { marca[q] = 1; paso[q] = paso[p] + 1; pila.push(q); }
    }
  }
  return marca;
}

/** Cambia la paleta de una mancha respetando su claroscuro. */
export function teñirMancha(d, marca, rampa) {
  if (!rampa) return;
  let min = 255, max = 0;
  for (let p = 0; p < marca.length; p++) {
    if (!marca[p]) continue;
    const i = p * 4, l = luzDe(d[i], d[i + 1], d[i + 2]);
    if (l < min) min = l;
    if (l > max) max = l;
  }
  if (max <= min) return;
  for (let p = 0; p < marca.length; p++) {
    if (!marca[p]) continue;
    const i = p * 4;
    const t = (luzDe(d[i], d[i + 1], d[i + 2]) - min) / (max - min);
    const [r, g, b] = enRampa(rampa, t);
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
}

/**
 * Rellena los huecos de una mancha: lo que está DENTRO pero no la toca.
 *
 * Es lo que convierte "la piel" en "la cara". Los ojos, las cejas y la boca
 * son islas oscuras rodeadas de piel; sin taparlas, el pelo se cuela por las
 * sombras del rostro —que no llegan a contar como piel— y acaba pintando las
 * cejas de rubio.
 */
function rellenarHuecos(marca, W, H) {
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
  const lleno = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) lleno[p] = marca[p] || !fuera[p] ? 1 : 0;
  return lleno;
}

/** Fila donde empieza la figura: la coronilla. */
function coronilla(d, W, H) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) return y;
  return 0;
}

/**
 * Quita las motas: píxeles sueltos de una mancha, sin apenas vecinos dentro
 * de ella. Son los que se colaban en las sombras de la mejilla y salían como
 * puntitos del color del pelo. El pelo de verdad viene en masa, nunca suelto.
 */
function quitarMotas(marca, W, H, minVecinos = 2, pasadas = 2) {
  for (let n = 0; n < pasadas; n++) {
    const fuera = [];
    for (let p = 0; p < marca.length; p++) {
      if (!marca[p]) continue;
      const x = p % W, y = (p - x) / W;
      let vecinos = 0;
      if (x > 0 && marca[p - 1]) vecinos++;
      if (x < W - 1 && marca[p + 1]) vecinos++;
      if (y > 0 && marca[p - W]) vecinos++;
      if (y < H - 1 && marca[p + W]) vecinos++;
      if (vecinos < minVecinos) fuera.push(p);
    }
    if (!fuera.length) break;
    for (const p of fuera) marca[p] = 0;
  }
}

/**
 * Mete en la mancha los huecos DIMINUTOS (1–2 px).
 *
 * Son brillos y sombras sueltos de la propia piel que el crecimiento no
 * alcanzó: al teñir el resto se quedaban con el color viejo y saltaban a la
 * vista como puntitos claros en una cara oscura. Los huecos grandes —ojos,
 * cejas, boca— se respetan, que para eso son rasgos.
 */
function taparHuecosMinusculos(marca, dentro, W, H, maxArea = 2) {
  const visto = new Uint8Array(W * H);
  for (let p0 = 0; p0 < marca.length; p0++) {
    if (marca[p0] || visto[p0] || !dentro[p0]) continue;
    const grupo = [];
    const pila = [p0];
    visto[p0] = 1;
    while (pila.length && grupo.length <= maxArea) {
      const p = pila.pop();
      grupo.push(p);
      const x = p % W, y = (p - x) / W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q < 0 || visto[q] || marca[q] || !dentro[q]) continue;
        visto[q] = 1;
        pila.push(q);
      }
    }
    if (grupo.length <= maxArea) for (const p of grupo) marca[p] = 1;
  }
}

/** Deja solo lo que puede ser piel: toca la cabeza, o es pequeño (manos). */
function filtrarManchasDePiel(marca, W, H, maxSuelta = 90) {
  const visto = new Uint8Array(W * H);
  for (let p0 = 0; p0 < marca.length; p0++) {
    if (!marca[p0] || visto[p0]) continue;
    const grupo = [];
    const pila = [p0];
    visto[p0] = 1;
    let tocaCabeza = false;
    while (pila.length) {
      const p = pila.pop();
      grupo.push(p);
      const x = p % W, y = (p - x) / W;
      if (y < CUELLO) tocaCabeza = true;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q < 0 || visto[q] || !marca[q]) continue;
        visto[q] = 1;
        pila.push(q);
      }
    }
    if (!tocaCabeza && grupo.length > maxSuelta) for (const p of grupo) marca[p] = 0;
  }
}

export function teñir(imgData, rampaPelo, rampaPiel) {
  const d = imgData.data, W = ANCHO, H = ALTO;

  // Las DOS manchas se calculan ANTES de teñir ninguna. Si se tiñe la piel
  // primero, el pelo se encuentra una cara ya oscurecida, la confunde con
  // pelo y la pinta de gris: es lo que pasaba con piel oscura.
  const piel = manchaPorVecindad(d, W, H,
    // Semilla: piel a plena luz. La ropa parda ni se acerca (r−b ≈ 70).
    (r, g, b) => luzDe(r, g, b) > 128 && r - b > 105 && r > g && g > b,
    // Crecimiento: sombras y brillos de la propia piel, solo si tocan.
    (r, g, b) => r - b > 80 && r >= g && g >= b,
    null, null, 6);

  // Fuera lo que no puede ser piel. Hace falta porque el COLOR no basta: la
  // falda ocre tiene r−b = 140, MÁS cálida que la propia piel (130), así que
  // pasa la semilla y se teñía entera. Lo que sí las separa es dónde están y
  // cuánto ocupan: la cara toca la banda de la cabeza y las manos son manchas
  // pequeñas; una prenda es grande y está abajo.
  filtrarManchasDePiel(piel, W, H);

  // El pelo se siembra SOLO en la coronilla y baja desde ahí.
  //
  // Antes se sembraba en todo píxel oscuro de la banda de la cabeza, y las
  // CEJAS, los OJOS y la BOCA son exactamente eso: islas oscuras dentro de la
  // cara. Se pintaban del color del pelo —cejas rubias sobre piel oscura— y
  // ensuciaban los rasgos. Creciendo desde arriba no se llega a ellas, porque
  // están rodeadas de piel y la piel corta el paso.
  // "La cara" = la piel con sus huecos tapados. Es la frontera del pelo.
  const cara = rellenarHuecos(piel, W, H);
  const arriba = coronilla(d, W, H);
  const pelo = manchaPorVecindad(d, W, H,
    (r, g, b, y) => y >= arriba && y < arriba + 6 && luzDe(r, g, b) < 95 && r >= b,
    (r, g, b, y) => y < CUELLO && luzDe(r, g, b) < 115 && r >= b,
    cara, // la cara entera es frontera: el pelo no la cruza
    // Y el veto que distingue una CEJA de un FLEQUILLO: una ceja tiene frente
    // justo encima; un flequillo tiene pelo. Sin esto, las cejas salían rubias.
    (q) => {
      const x = q % W, y = (q - x) / W;
      for (let dy = 1; dy <= 2; dy++) {
        const p = (y - dy) * W + x;
        if (y - dy >= 0 && piel[p]) return true;
      }
      return false;
    });

  // El pelo se aparta un píxel de la piel.
  //
  // Los mechones que el modelo dibuja cayendo sobre la sien o la mejilla son
  // pelo de verdad, pero teñidos de un color de mucho contraste —rubio sobre
  // piel oscura— gritan y ensucian la cara. Retirándolos queda entre pelo y
  // piel el contorno oscuro original, que es justo lo que dibujaría a mano un
  // pixel artist. Se mira en las 8 direcciones para que no se cuelen diagonales.
  const pegadoAPiel = new Uint8Array(pelo.length);
  for (let p = 0; p < pelo.length; p++) {
    if (!pelo[p]) continue;
    const x = p % W, y = (p - x) / W;
    for (let dy = -1; dy <= 1 && !pegadoAPiel[p]; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (piel[ny * W + nx]) { pegadoAPiel[p] = 1; break; }
      }
    }
  }
  for (let p = 0; p < pelo.length; p++) if (pegadoAPiel[p]) pelo[p] = 0;

  quitarMotas(pelo, W, H);
  taparHuecosMinusculos(piel, cara, W, H);

  if (rampaPiel) teñirMancha(d, piel, rampaPiel);
  if (rampaPelo) teñirMancha(d, pelo, rampaPelo);
}
