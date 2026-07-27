/**
 * SELLOS: los rasgos pequeños de la cara (ojos, cejas, boca).
 * ===========================================================
 *
 * Por qué esto no se le pide al modelo, y no es una opinión:
 * medido sobre la plantilla, **un ojo son 7 píxeles y una boca son 2**, mientras
 * que el ruido entre dos tiradas del modelo es de 30–80 píxeles. Un cambio así
 * queda POR DEBAJO del ruido — es exactamente lo que nos pasó con la barba, que
 * movía 64 px cuando la deriva normal era 100. A este tamaño los rasgos se
 * dibujan a mano y se colocan por coordenadas, como en cualquier creador de
 * personajes pixel art.
 *
 * Los anclajes NO están escritos a mano: se localizan en la propia hoja. Los
 * rasgos son los **huecos** de la mancha de piel —islas oscuras rodeadas de
 * cara—, así que se detectan solos en las cuatro vistas y valen igual para el
 * chico, para la chica y para cualquier peinado nuevo que se genere.
 */

/** '.' = no tocar · 'X' = trazo · 'o' = brillo · '-' = borrar (dejar piel) */
export const OJOS = {
  normal: ['.X.', 'XXo', '.X.'],
  rasgado: ['...', 'XXX', '.X.'],
  grande: ['XXX', 'XoX', 'XXX'],
  caido: ['.X.', 'XXo', 'XX.'],
  despierto: ['XXX', 'XoX', '.X.'],
};

export const CEJAS = {
  recta: ['XXX'],
  arqueada: ['.XX', 'X..'],
  gruesa: ['XXX', 'XXX'],
  fina: ['.X.'],
  enfadada: ['..X', 'XX.'],
};

export const BOCAS = {
  neutra: ['XX'],
  sonrisa: ['X.', '.X'],
  seria: ['XXX'],
  pequena: ['X.'],
};

/** Color de los ojos: solo el brillo cambia, el trazo sigue siendo oscuro. */
export const COLOR_OJOS = {
  marron: '#3A2318',
  miel: '#6B4A1E',
  verde: '#2E4A2A',
  azul: '#2B3C5E',
  gris: '#3E4147',
};

const luzDe = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/**
 * Localiza los rasgos de una vista: los huecos oscuros dentro de la cara.
 * Devuelve `{ ojos: [caja, caja], cejas: [...], boca: caja }` en coordenadas de
 * la hoja. Se apoya en la geometría, no en el color: los ojos son el par de
 * manchas a la misma altura, la boca es la mancha más baja.
 */
export function localizarRasgos(d, W, H, x0, x1, limiteCabeza = 42) {
  const alto = Math.min(limiteCabeza, H);
  const esPiel = (x, y) => {
    const i = (y * W + x) * 4;
    if (!d[i + 3]) return false;
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    return luzDe(r, g, b) > 100 && r - b > 70 && r >= g && g >= b;
  };

  // Mancha de piel de esta vista, dentro de la banda de la cabeza.
  const an = x1 - x0;
  const piel = new Uint8Array(an * alto);
  let hay = 0;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < an; x++) if (esPiel(x0 + x, y)) { piel[y * an + x] = 1; hay++; }
  }
  if (hay < 20) return null; // de espaldas no hay cara: no se toca nada

  // Los RASGOS son los HUECOS CERRADOS de esa mancha: ojos, cejas, nariz y boca
  // son islas rodeadas de piel. El pelo que baja por la sien parece un rasgo por
  // color, pero nunca está cerrado —viene de fuera—, así que se descarta solo.
  // Es el mismo criterio que arregló el color: no qué eres, sino a qué tocas.
  const fuera = new Uint8Array(an * alto);
  const pila = [];
  const meter = (p) => { if (!piel[p] && !fuera[p]) { fuera[p] = 1; pila.push(p); } };
  for (let x = 0; x < an; x++) { meter(x); meter((alto - 1) * an + x); }
  for (let y = 0; y < alto; y++) { meter(y * an); meter(y * an + an - 1); }
  while (pila.length) {
    const p = pila.pop(), x = p % an, y = (p - x) / an;
    if (x > 0) meter(p - 1);
    if (x < an - 1) meter(p + 1);
    if (y > 0) meter(p - an);
    if (y < alto - 1) meter(p + an);
  }

  const visto = new Uint8Array(an * alto);
  const manchas = [];
  for (let p0 = 0; p0 < an * alto; p0++) {
    if (piel[p0] || fuera[p0] || visto[p0]) continue;
    const grupo = [];
    const cola = [p0];
    visto[p0] = 1;
    while (cola.length) {
      const p = cola.pop();
      grupo.push(p);
      const x = p % an, y = (p - x) / an;
      for (const q of [x > 0 ? p - 1 : -1, x < an - 1 ? p + 1 : -1, y > 0 ? p - an : -1, y < alto - 1 ? p + an : -1]) {
        if (q < 0 || visto[q] || piel[q] || fuera[q]) continue;
        visto[q] = 1;
        cola.push(q);
      }
    }
    if (grupo.length > 24) continue; // demasiado grande para ser un rasgo
    const xs = grupo.map((p) => p % an), ys = grupo.map((p) => (p - (p % an)) / an);
    manchas.push({
      x0: x0 + Math.min(...xs), x1: x0 + Math.max(...xs),
      y0: Math.min(...ys), y1: Math.max(...ys), n: grupo.length,
      cx: x0 + (Math.min(...xs) + Math.max(...xs)) / 2,
      cy: (Math.min(...ys) + Math.max(...ys)) / 2,
    });
  }
  if (!manchas.length) return null;

  // OJOS: el par de manchas mayores que están a la MISMA altura (±1 px). Si solo
  // hay una (los perfiles enseñan un ojo), vale igual.
  const porTam = [...manchas].sort((a, b) => b.n - a.n);
  let ojos = [porTam[0]];
  for (const m of porTam.slice(1)) {
    if (Math.abs(m.cy - ojos[0].cy) <= 1.5 && m.cx !== ojos[0].cx) { ojos.push(m); break; }
  }
  ojos.sort((a, b) => a.cx - b.cx);
  // BOCA: la mancha más baja que no sea un ojo.
  const resto = manchas.filter((m) => !ojos.includes(m) && m.cy > ojos[0].cy + 2);
  const boca = resto.sort((a, b) => b.cy - a.cy)[0] ?? null;

  return { ojos, boca };
}

/** Color de piel dominante alrededor de una caja, para borrar el rasgo. */
function pielAlrededor(d, W, caja) {
  const cuenta = new Map();
  for (let y = caja.y0 - 1; y <= caja.y1 + 1; y++) {
    for (let x = caja.x0 - 1; x <= caja.x1 + 1; x++) {
      if (y >= caja.y0 && y <= caja.y1 && x >= caja.x0 && x <= caja.x1) continue;
      const i = (y * W + x) * 4;
      if (!d[i + 3]) continue;
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      if (luzDe(r, g, b) < 100 || r - b < 70) continue;
      const k = `${r},${g},${b}`;
      cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
    }
  }
  let mejor = null, max = 0;
  for (const [k, n] of cuenta) if (n > max) { max = n; mejor = k; }
  return mejor ? mejor.split(',').map(Number) : null;
}

/** Dibuja un patrón centrado en una caja, borrando antes lo que había. */
function estampar(d, W, caja, patron, trazo, brillo) {
  const piel = pielAlrededor(d, W, caja);
  if (!piel) return;
  // Borrar: la piel de alrededor tapa el rasgo viejo.
  for (let y = caja.y0; y <= caja.y1; y++) {
    for (let x = caja.x0; x <= caja.x1; x++) {
      const i = (y * W + x) * 4;
      if (!d[i + 3]) continue;
      d[i] = piel[0]; d[i + 1] = piel[1]; d[i + 2] = piel[2];
    }
  }
  const alto = patron.length, ancho = Math.max(...patron.map((f) => f.length));
  const ox = Math.round((caja.x0 + caja.x1) / 2 - (ancho - 1) / 2);
  const oy = Math.round((caja.y0 + caja.y1) / 2 - (alto - 1) / 2);
  for (let fy = 0; fy < alto; fy++) {
    for (let fx = 0; fx < patron[fy].length; fx++) {
      const c = patron[fy][fx];
      if (c === '.') continue;
      const x = ox + fx, y = oy + fy;
      const i = (y * W + x) * 4;
      if (!d[i + 3]) continue;
      const col = c === 'o' ? brillo : trazo;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
    }
  }
}

/**
 * Aplica los sellos elegidos a una hoja de 4 vistas.
 * `eleccion = { ojos, boca, colorOjos }`. La vista de espaldas no tiene cara, así
 * que se salta sola: `localizarRasgos` no encuentra rasgos y no toca nada.
 */
export function aplicarSellos(imgData, W, H, anchoVista, eleccion) {
  const d = imgData.data;
  const trazo = hex('#2A1A12');
  const brillo = hex(COLOR_OJOS[eleccion.colorOjos] ?? COLOR_OJOS.marron);
  for (let v = 0; v * anchoVista < W; v++) {
    const r = localizarRasgos(d, W, H, v * anchoVista, (v + 1) * anchoVista);
    if (!r) continue;
    if (eleccion.ojos && OJOS[eleccion.ojos]) {
      for (const ojo of r.ojos) estampar(d, W, ojo, OJOS[eleccion.ojos], trazo, brillo);
    }
    if (eleccion.boca && BOCAS[eleccion.boca] && r.boca) {
      estampar(d, W, r.boca, BOCAS[eleccion.boca], trazo, trazo);
    }
  }
}
