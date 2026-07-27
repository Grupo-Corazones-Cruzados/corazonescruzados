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
export const ORDEN = ['brazoLejano', 'piernaIzq', 'piernaDer', 'faldon', 'pieIzq', 'pieDer', 'torso', 'cabeza', 'brazoCercano'];

/**
 * El rig DEPENDE DE LA PRENDA, y esto no es un capricho: se descubrió moviendo
 * el muñeco. Con dos piernas independientes, una **falda se abre en canal** al
 * rotar cada mitad por su lado, como si fueran pantalones.
 *
 * Con falda: el faldón es UNA pieza que se balancea entera desde la cadera, y
 * los pies asoman por debajo como piezas sueltas que dan el paso.
 * Con pantalón: dos piernas, cada una con su pie incluido.
 */
export function esqueletoPara(sexo, prendaAbajo = '') {
  const base = ESQUELETO[sexo] ?? ESQUELETO.mujer;
  const esFalda = /falda|vestido|tunica/i.test(prendaAbajo);
  const { piernaIzq, piernaDer, faldon, pieIzq, pieDer, ...comunes } = base;
  return esFalda
    ? { ...comunes, faldon, pieIzq, pieDer }
    : { ...comunes, piernaIzq, piernaDer };
}

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
    // --- Variante con FALDA ---
    // El faldón se balancea entero desde la cadera; girarlo poco basta, porque
    // la tela no dobla como una pierna.
    faldon: { caja: { x: 28, y: 78, w: 40, h: 32 }, pivote: { x: 48, y: 80 }, padre: 'torso' },
    pieIzq: { caja: { x: 34, y: 104, w: 15, h: 24 }, pivote: { x: 42, y: 106 }, padre: 'torso' },
    pieDer: { caja: { x: 47, y: 104, w: 15, h: 24 }, pivote: { x: 54, y: 106 }, padre: 'torso' },
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
    faldon: { caja: { x: 28, y: 78, w: 40, h: 32 }, pivote: { x: 48, y: 80 }, padre: 'torso' },
    pieIzq: { caja: { x: 34, y: 104, w: 15, h: 24 }, pivote: { x: 42, y: 106 }, padre: 'torso' },
    pieDer: { caja: { x: 47, y: 104, w: 15, h: 24 }, pivote: { x: 54, y: 106 }, padre: 'torso' },
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

/**
 * Mide el esqueleto DE CADA VISTA sobre la propia hoja.
 * =====================================================
 *
 * Antes había un solo juego de cajas, medido de frente, aplicado a las cuatro
 * vistas. Y eso **no puede funcionar**: de espaldas los brazos caen en otro
 * sitio y de perfil la figura es mucho más estrecha, así que el recorte del
 * brazo se llevaba trozos de falda y dejaba manos sueltas flotando.
 *
 * En vez de escribir cuatro juegos de números a mano, se miden: la silueta dice
 * dónde está el cuello (la fila más estrecha bajo la cabeza), dónde se abren los
 * hombros y por dónde va la cintura. Así vale para el chico, para la chica y
 * para cualquier prenda que se genere mañana.
 */
export function medirEsqueleto(hoja, anchoHoja, vista, opciones = {}) {
  const { anchoCelda = 96, altoCelda = 128, esFalda = false } = opciones;
  const x0v = vista * anchoCelda;

  // Silueta: primer y último píxel opaco de cada fila.
  const filas = [];
  for (let y = 0; y < altoCelda; y++) {
    let a = -1, b = -1;
    for (let x = 0; x < anchoCelda; x++) {
      if (hoja[((y * anchoHoja) + x0v + x) * 4 + 3] > 40) { if (a < 0) a = x; b = x; }
    }
    filas.push(a < 0 ? null : { x0: a, x1: b, ancho: b - a + 1 });
  }
  const conFigura = filas.map((f, y) => (f ? y : -1)).filter((y) => y >= 0);
  if (!conFigura.length) return null;
  const yArriba = conFigura[0], yAbajo = conFigura[conFigura.length - 1];
  const alto = yAbajo - yArriba;

  // EL CUELLO es la fila más estrecha del tercio superior: la cabeza es ancha,
  // los hombros también, y entre medias hay un estrechamiento inconfundible.
  let yCuello = yArriba + Math.round(alto * 0.3);
  let masEstrecha = Infinity;
  for (let y = yArriba + Math.round(alto * 0.18); y < yArriba + Math.round(alto * 0.42); y++) {
    if (filas[y] && filas[y].ancho < masEstrecha) { masEstrecha = filas[y].ancho; yCuello = y; }
  }
  // LA CINTURA: donde acaba el torso. Se toma por proporción porque en muchas
  // prendas no hay estrechamiento (una túnica cae recta) y buscarlo daría un
  // resultado inventado.
  const yCintura = yArriba + Math.round(alto * 0.66);
  const yTobillo = yAbajo - Math.round(alto * 0.14);

  // Caja de una banda: lo que ocupa la figura entre dos filas.
  const caja = (yIni, yFin, recorteX = 0) => {
    let a = anchoCelda, b = -1;
    for (let y = Math.max(0, yIni); y <= Math.min(altoCelda - 1, yFin); y++) {
      if (!filas[y]) continue;
      if (filas[y].x0 < a) a = filas[y].x0;
      if (filas[y].x1 > b) b = filas[y].x1;
    }
    if (b < a) return null;
    return { x: a + recorteX, y: Math.max(0, yIni), w: b - a + 1 - recorteX * 2, h: Math.min(altoCelda, yFin + 1) - Math.max(0, yIni) };
  };

  const cTorso = caja(yCuello - 2, yCintura);
  if (!cTorso) return null;
  // Los brazos son los bordes exteriores del torso. Un quinto del ancho a cada
  // lado: medido, es lo que ocupa la manga sin comerse el pecho.
  const anchoBrazo = Math.max(6, Math.round(cTorso.w * 0.22));
  const cCabeza = caja(yArriba - 1, yCuello + 2);
  const cAbajo = caja(yCintura - 2, yAbajo);
  const centro = Math.round(cTorso.x + cTorso.w / 2);

  const esq = {
    cabeza: { caja: cCabeza, pivote: { x: centro, y: yCuello }, padre: 'torso' },
    torso: {
      caja: { x: cTorso.x + anchoBrazo, y: cTorso.y, w: Math.max(4, cTorso.w - anchoBrazo * 2), h: cTorso.h },
      pivote: { x: centro, y: yCintura }, padre: null,
    },
    brazoLejano: {
      caja: { x: cTorso.x, y: cTorso.y + 4, w: anchoBrazo, h: cTorso.h - 4 },
      pivote: { x: cTorso.x + anchoBrazo, y: cTorso.y + 6 }, padre: 'torso',
    },
    brazoCercano: {
      caja: { x: cTorso.x + cTorso.w - anchoBrazo, y: cTorso.y + 4, w: anchoBrazo, h: cTorso.h - 4 },
      pivote: { x: cTorso.x + cTorso.w - anchoBrazo, y: cTorso.y + 6 }, padre: 'torso',
    },
    anclajeMano: { x: cTorso.x + cTorso.w, y: yCintura - 2, padre: 'brazoCercano' },
  };

  if (esFalda) {
    esq.faldon = { caja: { ...cAbajo, h: yTobillo - cAbajo.y }, pivote: { x: centro, y: yCintura }, padre: 'torso' };
    const anchoPie = Math.round((cAbajo.w) / 2);
    esq.pieIzq = { caja: { x: cAbajo.x, y: yTobillo - 2, w: anchoPie, h: yAbajo - yTobillo + 3 }, pivote: { x: cAbajo.x + anchoPie, y: yTobillo }, padre: 'torso' };
    esq.pieDer = { caja: { x: cAbajo.x + anchoPie, y: yTobillo - 2, w: anchoPie, h: yAbajo - yTobillo + 3 }, pivote: { x: cAbajo.x + anchoPie, y: yTobillo }, padre: 'torso' };
  } else {
    const mitad = Math.round(cAbajo.w / 2);
    esq.piernaIzq = { caja: { x: cAbajo.x, y: cAbajo.y, w: mitad, h: cAbajo.h }, pivote: { x: cAbajo.x + mitad, y: yCintura + 2 }, padre: 'torso' };
    esq.piernaDer = { caja: { x: cAbajo.x + mitad, y: cAbajo.y, w: cAbajo.w - mitad, h: cAbajo.h }, pivote: { x: cAbajo.x + mitad, y: yCintura + 2 }, padre: 'torso' };
  }
  return esq;
}
