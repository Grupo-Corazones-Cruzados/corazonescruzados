/**
 * COMPONER el personaje: una sola función, dos mundos.
 * ====================================================
 *
 * La usa el **creador** en el navegador (sobre un canvas) y la usará el
 * **servidor** para generar la hoja que consume Godot. Por eso no toca el DOM ni
 * el sistema de archivos: recibe los píxeles ya cargados y devuelve píxeles.
 *
 * El orden NO es arbitrario; cada paso depende del anterior:
 *   1. **Bandas** — cabeza (peinado), torso (prenda de arriba), piernas (la de
 *      abajo). Cada pieza aporta su franja; la costura queda donde una prenda
 *      cae sobre la otra.
 *   2. **Complexión** — estira el torso ANTES de teñir, para que el color se
 *      calcule sobre la silueta definitiva.
 *   3. **Color** de pelo y piel.
 *   4. **Sellos** de ojos y boca, que van sobre la piel ya teñida.
 *   5. **Accesorio** encima del todo, con su color propio: un gorro no es pelo.
 */

import { teñir, RAMPA_PELO, RAMPA_PIEL } from './recolor.js';
import { aplicarSellos } from './sellos.js';
import { aplicarComplexion, COMPLEXIONES } from './complexion.js';

export const CELDA = { ancho: 96, alto: 128 };
export const BANDAS = { cuello: 42, cintura: 80 };
export const VISTAS = 4;

/** Elección por defecto: el personaje tal como salió de la plantilla. */
export const POR_DEFECTO = {
  sexo: 'mujer',
  peinado: 'base',
  accesorio: 'ninguno',
  arriba: 'base',
  abajo: 'base',
  complexion: 'normal',
  pelo: 'castano',
  piel: 'media',
  ojos: 'normales',
  boca: 'neutra',
  colorOjos: 'marron',
};

/** Copia una franja de filas de una hoja a otra. */
function pegarBanda(destino, origen, W, y0, y1) {
  const desde = y0 * W * 4;
  const hasta = y1 * W * 4;
  destino.set(origen.subarray(desde, hasta), desde);
}

/**
 * @param {object} piezas  { cabeza, arriba, abajo, accesorio } → Uint8ClampedArray RGBA
 *                         de hojas completas (384×128). `accesorio` puede faltar.
 * @param {object} eleccion  ver POR_DEFECTO
 * @returns {Uint8ClampedArray} la hoja compuesta
 */
export function componer(piezas, eleccion) {
  const e = { ...POR_DEFECTO, ...eleccion };
  const W = CELDA.ancho * VISTAS;
  const H = CELDA.alto;
  const salida = new Uint8ClampedArray(W * H * 4);

  // 1. Bandas
  pegarBanda(salida, piezas.cabeza, W, 0, BANDAS.cuello);
  pegarBanda(salida, piezas.arriba, W, BANDAS.cuello, BANDAS.cintura);
  pegarBanda(salida, piezas.abajo, W, BANDAS.cintura, H);

  // 2–4 se hacen VISTA A VISTA: el color y los sellos razonan sobre una cara,
  // no sobre una tira de cuatro.
  for (let v = 0; v < VISTAS; v++) {
    const celda = new Uint8ClampedArray(CELDA.ancho * CELDA.alto * 4);
    for (let y = 0; y < H; y++) {
      const desde = (y * W + v * CELDA.ancho) * 4;
      celda.set(salida.subarray(desde, desde + CELDA.ancho * 4), y * CELDA.ancho * 4);
    }

    if (e.complexion !== 'normal') {
      const f = COMPLEXIONES[e.complexion] ?? 1;
      aplicarComplexion({ data: celda }, CELDA.ancho, CELDA.ancho, BANDAS.cuello, BANDAS.cintura, CELDA.alto, {
        torso: f,
        // En la chica las caderas acompañan al torso, pero menos.
        caderas: e.sexo === 'mujer' ? 1 + (f - 1) * 0.6 : 1,
      });
    }

    teñir({ data: celda }, RAMPA_PELO[e.pelo], RAMPA_PIEL[e.piel]);
    aplicarSellos({ data: celda }, CELDA.ancho, CELDA.alto, CELDA.ancho,
      { ojos: e.ojos, boca: e.boca, colorOjos: e.colorOjos }, e.sexo);

    for (let y = 0; y < H; y++) {
      const hacia = (y * W + v * CELDA.ancho) * 4;
      salida.set(celda.subarray(y * CELDA.ancho * 4, (y + 1) * CELDA.ancho * 4), hacia);
    }
  }

  // 5. Accesorio encima, sin teñir: conserva su color.
  if (piezas.accesorio) {
    for (let i = 0; i < salida.length; i += 4) {
      if (!piezas.accesorio[i + 3]) continue;
      salida[i] = piezas.accesorio[i];
      salida[i + 1] = piezas.accesorio[i + 1];
      salida[i + 2] = piezas.accesorio[i + 2];
      salida[i + 3] = 255;
    }
  }

  return salida;
}
