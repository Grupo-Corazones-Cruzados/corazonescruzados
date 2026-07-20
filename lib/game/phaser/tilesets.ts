import { SHEETS, TILE_PX } from '@/components/landing/world/sheets';

/**
 * Carga de tilesets para Phaser, con el chroma key que ya usaba el juego.
 *
 * Los PNG de tilesets traen fondo blanco en vez de transparencia, así que hay
 * que volver transparente todo píxel casi blanco. Eso ya se hacía
 * (`sheetLoader.ts`), pero se rehacía **en cada montaje y para las 11 hojas**,
 * incluida una de 3072 tiles — y encima por duplicado, porque el mundo se
 * renderizaba dos veces. Aquí el resultado se cachea a nivel de módulo: el
 * trabajo por píxel ocurre una sola vez por sesión de navegador.
 */

/** Umbral de "casi blanco" heredado del renderer anterior. */
const WHITE_CUTOFF = 250;

/** Canvas ya procesados, por URL. Sobrevive a reinicios de escena. */
const chromaCache = new Map<string, HTMLCanvasElement>();

/** Promesas en vuelo, para que dos peticiones a la vez no dupliquen trabajo. */
const inFlight = new Map<string, Promise<HTMLCanvasElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar el tileset: ${url}`));
    img.src = url;
  });
}

/** Devuelve el tileset con el blanco convertido en transparencia. */
export async function loadChromaKeyed(url: string): Promise<HTMLCanvasElement> {
  const cached = chromaCache.get(url);
  if (cached) return cached;
  const pending = inFlight.get(url);
  if (pending) return pending;

  const task = (async () => {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Sin contexto 2D para el chroma key');
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] >= WHITE_CUTOFF && px[i + 1] >= WHITE_CUTOFF && px[i + 2] >= WHITE_CUTOFF) {
        px[i + 3] = 0;
      }
    }
    ctx.putImageData(data, 0, 0);

    chromaCache.set(url, canvas);
    inFlight.delete(url);
    return canvas;
  })();

  inFlight.set(url, task);
  return task;
}

/**
 * Reparto de identificadores globales de tile (gid).
 *
 * El formato guardado identifica un tile como (índice de hoja, columna, fila).
 * Phaser trabaja con un número plano por tileset, así que a cada hoja se le
 * asigna un rango contiguo. El 0 queda reservado para "vacío".
 */
export type SheetRegistration = {
  sheetIndex: number;
  textureKey: string;
  firstGid: number;
  cols: number;
  rows: number;
};

/** Convierte (hoja, columna, fila) al gid plano que entiende Phaser. */
export function toGid(reg: SheetRegistration, sx: number, sy: number): number {
  return reg.firstGid + sy * reg.cols + sx;
}

/**
 * Prepara en Phaser solo las hojas que el mapa usa de verdad.
 *
 * Cargar las 11 siempre es desperdicio: un interior no necesita acantilados ni
 * bosque. Se recorren los tiles para saber cuáles hacen falta.
 */
export async function registerSheetsForMap(
  scene: Phaser.Scene,
  usedSheetIndexes: Iterable<number>,
): Promise<Map<number, SheetRegistration>> {
  const used = [...new Set(usedSheetIndexes)].sort((a, b) => a - b);
  const out = new Map<number, SheetRegistration>();

  // El gid 0 significa "sin tile", así que el reparto empieza en 1.
  let nextGid = 1;

  for (const idx of used) {
    const def = SHEETS[idx];
    if (!def) continue; // Índice huérfano en datos viejos: se ignora, no se rompe.

    const textureKey = `sheet:${def.id}`;
    if (!scene.textures.exists(textureKey)) {
      const canvas = await loadChromaKeyed(def.url);
      scene.textures.addCanvas(textureKey, canvas);
    }

    out.set(idx, {
      sheetIndex: idx,
      textureKey,
      firstGid: nextGid,
      cols: def.cols,
      rows: def.rows,
    });
    nextGid += def.cols * def.rows;
  }

  return out;
}

export { TILE_PX };
