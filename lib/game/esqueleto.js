/**
 * EL ESQUELETO: en qué partes se corta el personaje y por dónde articula.
 * =======================================================================
 *
 * Es el camino 2 + 3 (el de Guardian Tales): el cuerpo se corta en piezas
 * atadas a huesos, y lo que se sujeta con la mano cuelga de un anclaje. La
 * ventaja que lo justifica: **un casco o una armadura se dibujan UNA vez** y
 * sirven para caminar, correr, atacar y para cualquier animación futura.
 *
 * Las cajas NO están puestas a ojo: salen de medir la silueta de la plantilla
 * fila a fila. En la chica el cuello se estrecha a 12 px en y≈39, los hombros
 * se abren en y 42, la cadera está en y 80 y las piernas se separan en y 108.
 *
 * Y algo importante: **las mismas cajas valen para TODAS las piezas** —cada
 * prenda, cada peinado— porque todo el catálogo se genera editando la misma
 * plantilla y quedó recuadrado en la misma rejilla. Cortar una armadura nueva
 * es aplicarle estas cajas, sin medir nada.
 *
 * `pivote` es el punto por el que la pieza gira, en coordenadas de la CELDA
 * (96×128). Es lo que en Godot será la posición del hueso.
 */

/** Orden de dibujo: de atrás hacia delante. */
export const ORDEN = ['brazoLejano', 'piernaIzq', 'piernaDer', 'torso', 'cabeza', 'brazoCercano'];

export const ESQUELETO = {
  mujer: {
    // La cabeza gira sobre el cuello.
    cabeza: { caja: { x: 32, y: 6, w: 34, h: 36 }, pivote: { x: 48, y: 40 }, padre: 'torso' },
    // El torso pivota sobre la cadera: al inclinarse, arrastra a todo lo de arriba.
    torso: { caja: { x: 33, y: 38, w: 30, h: 44 }, pivote: { x: 48, y: 80 }, padre: null },
    // Los brazos giran desde el hombro. Se solapan con el torso a propósito:
    // así la manga no deja hueco al levantarse.
    brazoCercano: { caja: { x: 58, y: 44, w: 12, h: 38 }, pivote: { x: 62, y: 48 }, padre: 'torso' },
    brazoLejano: { caja: { x: 26, y: 44, w: 12, h: 38 }, pivote: { x: 34, y: 48 }, padre: 'torso' },
    // Piernas: desde la cadera hasta los pies, partidas por el centro.
    piernaIzq: { caja: { x: 28, y: 78, w: 21, h: 48 }, pivote: { x: 43, y: 82 }, padre: 'torso' },
    piernaDer: { caja: { x: 47, y: 78, w: 21, h: 48 }, pivote: { x: 53, y: 82 }, padre: 'torso' },
    // Dónde va lo que se sujeta. Sigue al brazo cercano.
    anclajeMano: { x: 64, y: 76, padre: 'brazoCercano' },
  },
  hombre: {
    cabeza: { caja: { x: 32, y: 4, w: 34, h: 36 }, pivote: { x: 48, y: 38 }, padre: 'torso' },
    torso: { caja: { x: 33, y: 36, w: 30, h: 46 }, pivote: { x: 48, y: 80 }, padre: null },
    brazoCercano: { caja: { x: 58, y: 42, w: 12, h: 40 }, pivote: { x: 62, y: 46 }, padre: 'torso' },
    brazoLejano: { caja: { x: 26, y: 42, w: 12, h: 40 }, pivote: { x: 34, y: 46 }, padre: 'torso' },
    piernaIzq: { caja: { x: 28, y: 78, w: 21, h: 48 }, pivote: { x: 43, y: 82 }, padre: 'torso' },
    piernaDer: { caja: { x: 47, y: 78, w: 21, h: 48 }, pivote: { x: 53, y: 82 }, padre: 'torso' },
    anclajeMano: { x: 64, y: 74, padre: 'brazoCercano' },
  },
};

/**
 * Corta una VISTA de la hoja compuesta en las piezas del esqueleto.
 *
 * @param {Uint8ClampedArray} hoja  la hoja completa (384×128 RGBA)
 * @param {number} anchoHoja
 * @param {number} vista  0 frente · 1 espalda · 2 izquierda · 3 derecha
 * @param {object} esqueleto  ESQUELETO.mujer u ESQUELETO.hombre
 * @returns {Record<string,{ancho:number,alto:number,px:Uint8ClampedArray,pivote:{x:number,y:number}}>}
 */
export function cortarPartes(hoja, anchoHoja, vista, esqueleto, anchoCelda = 96, altoCelda = 128) {
  const partes = {};
  const x0Celda = vista * anchoCelda;

  for (const [nombre, def] of Object.entries(esqueleto)) {
    if (!def.caja) continue; // el anclaje de la mano no es una pieza dibujada
    const { x, y, w, h } = def.caja;
    const px = new Uint8ClampedArray(w * h * 4);
    let opacos = 0;
    for (let fy = 0; fy < h; fy++) {
      const oy = y + fy;
      if (oy < 0 || oy >= altoCelda) continue;
      for (let fx = 0; fx < w; fx++) {
        const ox = x + fx;
        if (ox < 0 || ox >= anchoCelda) continue;
        const desde = ((oy * anchoHoja) + x0Celda + ox) * 4;
        const hacia = (fy * w + fx) * 4;
        px[hacia] = hoja[desde];
        px[hacia + 1] = hoja[desde + 1];
        px[hacia + 2] = hoja[desde + 2];
        px[hacia + 3] = hoja[desde + 3];
        if (hoja[desde + 3]) opacos++;
      }
    }
    partes[nombre] = {
      ancho: w,
      alto: h,
      px,
      opacos,
      // El pivote, relativo a la pieza: es lo que Godot necesita como offset.
      pivote: { x: def.pivote.x - x, y: def.pivote.y - y },
      padre: def.padre,
    };
  }
  return partes;
}
