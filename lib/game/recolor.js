/**
 * Recoloreado del personaje: pelo y piel, sin gastar generaciones.
 *
 * Lo usa el probador y lo usará el creador. Se documenta aquí el porqué de cada
 * decisión, que salió de medir la plantilla y de tres fallos reales.
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
function manchaPorVecindad(d, W, H, estricto, flojo) {
  const marca = new Uint8Array(W * H);
  const pila = [];
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (d[i + 3] && estricto(d[i], d[i + 1], d[i + 2], Math.floor(p / W))) { marca[p] = 1; pila.push(p); }
  }
  while (pila.length) {
    const p = pila.pop(), x = p % W, y = (p - x) / W;
    const vecinos = [];
    if (x > 0) vecinos.push(p - 1);
    if (x < W - 1) vecinos.push(p + 1);
    if (y > 0) vecinos.push(p - W);
    if (y < H - 1) vecinos.push(p + W);
    for (const q of vecinos) {
      if (marca[q]) continue;
      const i = q * 4;
      if (!d[i + 3]) continue;
      if (flojo(d[i], d[i + 1], d[i + 2], Math.floor(q / W))) { marca[q] = 1; pila.push(q); }
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

export function teñir(imgData, rampaPelo, rampaPiel) {
  const d = imgData.data, W = ANCHO, H = ALTO;

  // Las DOS manchas se calculan ANTES de teñir ninguna. Si se tiñe la piel
  // primero, el pelo se encuentra una cara ya oscurecida, la confunde con
  // pelo y la pinta de gris: es lo que pasaba con piel oscura.
  const piel = rampaPiel ? manchaPorVecindad(d, W, H,
    // Semilla: piel a plena luz. La ropa parda ni se acerca (r−b ≈ 70).
    (r, g, b) => luzDe(r, g, b) > 128 && r - b > 105 && r > g && g > b,
    // Crecimiento: sombras y brillos de la propia piel, solo si tocan.
    (r, g, b) => r - b > 80 && r >= g && g >= b) : null;

  const pelo = rampaPelo ? manchaPorVecindad(d, W, H,
    // Semilla: castaño oscuro dentro de la banda de la cabeza.
    (r, g, b, y) => y < CUELLO && luzDe(r, g, b) < 80 && r - b > 12 && r >= g && g >= b,
    (r, g, b, y) => y < CUELLO && luzDe(r, g, b) < 115 && r >= b) : null;

  // Y por si acaso, el pelo nunca pisa lo que ya es piel.
  if (piel && pelo) for (let p = 0; p < pelo.length; p++) if (piel[p]) pelo[p] = 0;

  if (piel) teñirMancha(d, piel, rampaPiel);
  if (pelo) teñirMancha(d, pelo, rampaPelo);
}
