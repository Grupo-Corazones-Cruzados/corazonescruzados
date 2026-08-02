/**
 * EL ABANICO DE SATÉLITES — reparto tipo dendrograma.
 *
 * Un satélite es un recurso del que un paso **dispone durante toda su ejecución**, no un
 * paso siguiente. Por eso va al costado y con línea discontinua.
 *
 * Se calcula **aparte de ELK**: cada padre se centra sobre el bloque que ocupan sus hijos,
 * así con varias herramientas colgando de un concentrador este queda a la altura del grupo
 * y las curvas no se cruzan.
 *
 * ⚠️ ESTA FUNCIÓN SE LLAMA DOS VECES CON EL MISMO RESULTADO: una en el layout, para
 * decirle a ELK cuánto ocupa el conjunto, y otra al pintar la tarjeta. Si divergieran, ELK
 * reservaría un hueco distinto del que se dibuja y los abanicos pisarían al nodo vecino.
 * Por eso vive aquí y no duplicada en cada sitio.
 */

import type { Satelite } from '@/lib/agente/estudio/tipos';

export const SAT = {
  /** Alto de una fila. */
  alto: 34,
  /** Separación vertical entre hermanas. */
  hueco: 10,
  /** Ancho de cada columna. */
  ancho: 196,
  /** Separación horizontal entre columnas. */
  huecoColumna: 44,
  /** Separación entre la tarjeta y la primera columna. */
  huecoTarjeta: 40,
} as const;

export interface SateliteColocado {
  id: string;
  label: string;
  sublabel?: string;
  icono?: string;
  fuenteId?: string;
  /** Relativo a la esquina superior izquierda de la TARJETA. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
  nivel: number;
  /** Punto de partida de la curva que llega hasta aquí. */
  desde: { x: number; y: number };
}

/** Alto que ocupa un satélite con toda su descendencia. */
export function altoDe(s: Satelite): number {
  if (!s.hijos?.length) return SAT.alto;
  return s.hijos.reduce((t, h) => t + altoDe(h), 0) + SAT.hueco * (s.hijos.length - 1);
}

/** Alto total del abanico de un nodo. */
export function altoAbanico(satelites: Satelite[] | undefined): number {
  if (!satelites?.length) return 0;
  return satelites.reduce((t, s) => t + altoDe(s), 0) + SAT.hueco * (satelites.length - 1);
}

/** Profundidad máxima del árbol, para saber cuántas columnas ocupa. */
function profundidad(s: Satelite): number {
  if (!s.hijos?.length) return 1;
  return 1 + Math.max(...s.hijos.map(profundidad));
}

/** Ancho total del abanico, contando columnas y huecos. */
export function anchoAbanico(satelites: Satelite[] | undefined): number {
  if (!satelites?.length) return 0;
  const columnas = Math.max(...satelites.map(profundidad));
  return SAT.huecoTarjeta + columnas * SAT.ancho + (columnas - 1) * SAT.huecoColumna;
}

/**
 * Coloca el abanico a la derecha de una tarjeta de `anchoTarjeta` × `altoTarjeta`.
 * Las coordenadas devueltas son **relativas a la tarjeta**.
 */
export function colocarSatelites(
  satelites: Satelite[] | undefined,
  anchoTarjeta: number,
  altoTarjeta: number,
): SateliteColocado[] {
  if (!satelites?.length) return [];

  const total = altoAbanico(satelites);
  // El abanico se centra verticalmente respecto a la tarjeta.
  let cursor = altoTarjeta / 2 - total / 2;
  const salida: SateliteColocado[] = [];

  const colocar = (lista: Satelite[], nivel: number, arranque: number, origen: { x: number; y: number }) => {
    let y = arranque;
    for (const s of lista) {
      const alto = altoDe(s);
      // El padre se centra sobre el bloque que ocupan sus hijos.
      const centro = y + alto / 2;
      const x = anchoTarjeta + SAT.huecoTarjeta + nivel * (SAT.ancho + SAT.huecoColumna);
      salida.push({
        id: s.id, label: s.label, sublabel: s.sublabel, icono: s.icono, fuenteId: s.fuenteId,
        x, y: centro - SAT.alto / 2, ancho: SAT.ancho, alto: SAT.alto, nivel,
        desde: origen,
      });
      if (s.hijos?.length) {
        colocar(s.hijos, nivel + 1, y, { x: x + SAT.ancho, y: centro });
      }
      y += alto + SAT.hueco;
    }
  };

  colocar(satelites, 0, cursor, { x: anchoTarjeta, y: altoTarjeta / 2 });
  return salida;
}

/** Curva de Bézier horizontal entre dos puntos. */
export function curva(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(24, (x2 - x1) / 2);
  return `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}
