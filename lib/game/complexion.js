/**
 * COMPLEXIÓN: grosor del torso y tipo de cuerpo.
 * ==============================================
 *
 * No se generan siluetas nuevas: se **estira la banda** correspondiente en
 * horizontal. Es la misma técnica que ya usaba el creador viejo con LPC —que
 * solo trae 3 siluetas para 5 niveles— y tiene dos ventajas grandes: no gasta
 * una sola generación y **funciona sobre cualquier prenda**, incluidas las que
 * se generen mañana, porque estira el resultado ya compuesto.
 *
 * Se estira desde el CENTRO de cada figura, no desde el borde de la celda: si
 * no, el personaje se desplazaría hacia un lado al engordar. Y se hace con
 * vecino más cercano, columna a columna, para no emborronar el pixel art.
 *
 * Límite honesto: a ±15 % la silueta se ensancha de forma creíble; más allá el
 * dibujo se estira de forma visible (las rayas de la ropa se duplican). Por eso
 * los niveles llegan hasta ahí y no más.
 */

/** Cinco niveles, de delgado a fornido/ancho. 1 = tal como se dibujó. */
export const COMPLEXIONES = {
  delgada: 0.90,
  normal: 1.0,
  media: 1.06,
  fuerte: 1.12,
  ancha: 1.18,
};

/**
 * Estira en horizontal una banda de la hoja.
 *
 * @param {Uint8ClampedArray} d  píxeles RGBA de la hoja entera
 * @param {number} W  ancho total de la hoja
 * @param {number} anchoVista  ancho de cada celda (una por vista)
 * @param {number} y0,y1  banda a estirar
 * @param {number} factor  1 = sin cambio
 */
export function estirarBanda(d, W, anchoVista, y0, y1, factor) {
  if (Math.abs(factor - 1) < 0.001) return;
  const vistas = Math.round(W / anchoVista);

  for (let v = 0; v < vistas; v++) {
    const x0 = v * anchoVista;
    // Centro de la FIGURA en esta vista, no de la celda: cada vista puede tener
    // la figura ligeramente descentrada y estirar desde el sitio equivocado la
    // movería de lado.
    let min = anchoVista, max = -1;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < anchoVista; x++) {
        if (d[((y * W) + x0 + x) * 4 + 3]) { if (x < min) min = x; if (x > max) max = x; }
      }
    }
    if (max < min) continue;
    const centro = (min + max) / 2;

    for (let y = y0; y < y1; y++) {
      const fila = new Uint8ClampedArray(anchoVista * 4);
      for (let x = 0; x < anchoVista; x++) {
        // De destino a origen: para cada columna final se busca de dónde viene.
        const origen = Math.round(centro + (x - centro) / factor);
        if (origen < 0 || origen >= anchoVista) continue;
        const i = ((y * W) + x0 + origen) * 4;
        const j = x * 4;
        fila[j] = d[i]; fila[j + 1] = d[i + 1]; fila[j + 2] = d[i + 2]; fila[j + 3] = d[i + 3];
      }
      for (let x = 0; x < anchoVista; x++) {
        const i = ((y * W) + x0 + x) * 4, j = x * 4;
        d[i] = fila[j]; d[i + 1] = fila[j + 1]; d[i + 2] = fila[j + 2]; d[i + 3] = fila[j + 3];
      }
    }
  }
}

/**
 * Aplica la complexión al personaje ya compuesto.
 *
 * El TORSO se estira siempre; las CADERAS solo si se pide (para el tipo de
 * cuerpo). La cabeza nunca: una cabeza más ancha no lee como complexión, lee
 * como deformidad.
 */
export function aplicarComplexion(imgData, W, anchoVista, cuello, cintura, alto, { torso = 1, caderas = 1 } = {}) {
  estirarBanda(imgData.data, W, anchoVista, cuello, cintura, torso);
  estirarBanda(imgData.data, W, anchoVista, cintura, alto, caderas);
}
