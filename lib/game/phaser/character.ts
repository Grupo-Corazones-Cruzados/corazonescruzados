import Phaser from 'phaser';
import {
  ANIMATIONS,
  BEARD_STYLES,
  CLOTHING_STYLES,
  GLASSES_STYLES,
  HAIR_STYLES,
  SHOES_STYLES,
  type CharacterAnimation,
  type CharacterConfig,
} from '@/components/landing/CharacterCreator';

/**
 * Composición de personajes LPC en una sola textura.
 *
 * Antes cada personaje eran ~12 `<div>` apilados con `background-position`, uno
 * por capa (cuerpo, pelo, ropa, zapatos…). Con varios NPCs en pantalla eso son
 * decenas de nodos del DOM que React reconcilia en cada frame de movimiento.
 *
 * Aquí las capas se dibujan UNA vez sobre un mismo lienzo y el resultado se
 * registra como spritesheet. A partir de ahí el personaje es un sprite: se
 * dibuja en GPU y no toca el DOM.
 */

export const FRAME_SIZE = 64;
/** La hoja universal LPC mide 832 px = 13 columnas de 64. */
export const SHEET_COLS = 13;

export type Direction = 'n' | 's' | 'e' | 'w';

/** Texturas ya compuestas, por firma de configuración. */
const builtKeys = new Set<string>();

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    // Una capa que falte no debe tumbar al personaje: se dibuja sin ella.
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Traduce la configuración a la lista ordenada de imágenes a apilar.
 *
 * El orden importa y replica el del renderer anterior: cuerpo, pantalón,
 * zapatos, ropa, cabeza, ojos, cejas, barba, pelo, mochila y gafas. La mochila
 * va sobre pelo y ropa (zPos 110 en LPC) para que la correa se vea de frente y
 * la mochila de espaldas.
 *
 * Se omite el filtrado de animaciones extendidas (sentarse) que hacía el
 * componente: aquí se compone la hoja COMPLETA una vez, y es la animación la
 * que decide qué filas usa.
 */
export function resolveCharacterLayers(config: CharacterConfig, withBackpack = true): string[] {
  const gender = config.gender === 'masculino' ? 'male' : 'female';
  const headSheet = config.faceShape === 'standard' ? gender : `${gender}_${config.faceShape}`;

  const urls: (string | null)[] = [];

  urls.push(`/character/body/${gender}/${config.skinId}.png`);
  urls.push(`/character/pants/${gender}/${config.pantsColor || 'navy'}.png`);

  const shoes = SHOES_STYLES.find((s) => s.id === config.shoesStyle);
  urls.push(
    config.shoesStyle && config.shoesStyle !== 'none' && shoes
      ? `/character/shoes/${config.shoesStyle}/${gender}/${config.shoesColor || 'black'}.png`
      : null,
  );

  // La camiseta solo existe en la hoja femenina; se usa esa sea cual sea el
  // género configurado, para que el personaje siga pudiendo sentarse.
  const clothesGender = config.clothingStyle === 'tshirt' ? 'female' : gender;
  const clothes = CLOTHING_STYLES.find((c) => c.id === config.clothingStyle);
  urls.push(
    config.clothingStyle !== 'none' && clothes
      ? `/character/clothes/${config.clothingStyle}/${clothesGender}/${config.clothingColor}.png`
      : null,
  );

  urls.push(`/character/head/${headSheet}/${config.skinId}.png`);
  urls.push(`/character/eyes/${config.eyeColor}.png`);
  urls.push(
    config.eyebrowStyle !== 'none'
      ? `/character/eyebrows/${config.eyebrowStyle}/${config.hairColor}.png`
      : null,
  );

  const beard = BEARD_STYLES.find((b) => b.id === config.beardStyle);
  urls.push(
    config.gender === 'masculino' && beard?.file
      ? `/character/beards/${beard.file}/${config.hairColor}.png`
      : null,
  );

  const hair = HAIR_STYLES.find((h) => h.id === config.hairStyle);
  urls.push(
    hair?.file
      ? hair.gendered
        ? `/character/hair/${hair.file}/${gender}/${config.hairColor}.png`
        : `/character/hair/${hair.file}/${config.hairColor}.png`
      : null,
  );

  urls.push(withBackpack ? `/character/backpack/${gender}/leather.png` : null);

  const glasses = GLASSES_STYLES.find((g) => g.id === config.glassesStyle);
  urls.push(
    glasses?.file ? `/character/glasses/${glasses.file}/${config.glassesColor}.png` : null,
  );

  return urls.filter((u): u is string => typeof u === 'string');
}

/** Clave estable de textura: misma configuración, misma textura reutilizada. */
export function characterTextureKey(config: CharacterConfig, withBackpack = true): string {
  return `char:${withBackpack ? 'bp' : 'nb'}:${resolveCharacterLayers(config, withBackpack).join('|')}`;
}

/**
 * Compone el personaje y lo registra en Phaser como spritesheet de 64×64.
 * Devuelve la clave de textura, lista para `scene.add.sprite`.
 */
export async function buildCharacterTexture(
  scene: Phaser.Scene,
  config: CharacterConfig,
  withBackpack = true,
): Promise<string> {
  const key = characterTextureKey(config, withBackpack);
  if (builtKeys.has(key) && scene.textures.exists(key)) return key;

  const urls = resolveCharacterLayers(config, withBackpack);
  const images = await Promise.all(urls.map(loadImage));
  const present = images.filter((i): i is HTMLImageElement => i !== null);
  if (present.length === 0) throw new Error('El personaje no tiene ninguna capa cargable');

  // El lienzo toma el tamaño de la capa más grande: las hojas de accesorios a
  // veces traen menos filas que el cuerpo, y recortar por la más pequeña
  // cortaría animaciones.
  const width = Math.max(...present.map((i) => i.naturalWidth));
  const height = Math.max(...present.map((i) => i.naturalHeight));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sin contexto 2D para componer el personaje');
  ctx.imageSmoothingEnabled = false;

  for (const img of images) {
    if (img) ctx.drawImage(img, 0, 0);
  }

  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addSpriteSheet(key, canvas as unknown as HTMLImageElement, {
    frameWidth: FRAME_SIZE,
    frameHeight: FRAME_SIZE,
  });

  builtKeys.add(key);
  return key;
}

/** Nombre de la animación registrada para una combinación concreta. */
export function animKey(textureKey: string, anim: CharacterAnimation, dir: Direction): string {
  return `${textureKey}:${anim}:${dir}`;
}

/**
 * Registra en Phaser todas las animaciones del personaje.
 *
 * Aquí se corrige algo que el juego anterior declaraba pero no usaba: cada
 * animación tiene su propio `fps` en `ANIMATIONS`, pero todas avanzaban con el
 * mismo `setInterval(130ms)`. Ahora sí se respeta el ritmo de cada una, así que
 * correr, golpear o lanzar se mueven a la velocidad para la que fueron
 * dibujadas.
 */
export function registerCharacterAnimations(scene: Phaser.Scene, textureKey: string) {
  const directions: Direction[] = ['n', 's', 'e', 'w'];

  for (const [name, def] of Object.entries(ANIMATIONS) as [
    CharacterAnimation,
    (typeof ANIMATIONS)[CharacterAnimation],
  ][]) {
    for (const dir of directions) {
      const key = animKey(textureKey, name, dir);
      if (scene.anims.exists(key)) continue;

      // `hurt` solo existe mirando al sur: su fila es un número, no un mapa.
      const row = typeof def.rows === 'number' ? def.rows : def.rows[dir];
      const start = row * SHEET_COLS;
      const frames: number[] = [];
      for (let i = 0; i < def.frames; i++) frames.push(start + i);

      scene.anims.create({
        key,
        frames: frames.map((f) => ({ key: textureKey, frame: f })),
        frameRate: def.fps,
        // idle y walk son cíclicas; el resto son poses que terminan y se
        // quedan en su último frame.
        repeat: name === 'walk' || name === 'idle' ? -1 : 0,
      });
    }
  }
}
