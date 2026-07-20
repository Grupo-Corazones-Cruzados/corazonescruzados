/**
 * Catálogo LPC: tipos y tablas de estilos del personaje.
 *
 * Vive aquí, y no dentro de `CharacterCreator.tsx`, por una razón concreta que
 * costó un error en producción: ese componente lleva `'use client'`, y cuando
 * una ruta de servidor importa una constante de un módulo de cliente, **Next no
 * entrega el array sino un proxy de referencia**. El síntoma es
 * `SHOES_STYLES.find is not a function` — y el typecheck no lo detecta, porque
 * los tipos sí encajan.
 *
 * Este módulo es datos puros: sin React, sin hooks, sin `'use client'`. Lo
 * pueden importar tanto el componente como el servidor.
 *
 * `CharacterCreator.tsx` reexporta todo esto para no romper lo que ya importaba
 * desde allí.
 */

export type Gender = 'masculino' | 'femenino';

/** Contextura: ajusta el ancho de la silueta manteniendo la ropa alineada. */
export type BodyType = 'muy_delgado' | 'delgado' | 'medio' | 'obeso' | 'muy_obeso';

export type CharHeight = 'bajo' | 'medio' | 'alto';

export type Opt = { id: string; label: string; preview?: string; supportsSit?: boolean };
export type HairOpt = Opt & { file: string | null; gendered?: boolean };

export type CharacterConfig = {
  name: string;
  gender: Gender;
  skinId: string;
  bodyType: BodyType;
  height: CharHeight;
  faceShape: string;
  hairStyle: string;
  hairColor: string;
  eyeColor: string;
  eyebrowStyle: string;
  beardStyle: string;
  glassesStyle: string;
  glassesColor: string;
  clothingStyle: string;
  clothingColor: string;
  pantsColor: string;
  shoesStyle: string;
  shoesColor: string;
};

export const HAIR_STYLES: HairOpt[] = [
  { id: 'none', label: 'Rapado', file: null, supportsSit: true },
  { id: 'buzzcut', label: 'Buzzcut', file: 'buzzcut', supportsSit: true },
  { id: 'bob', label: 'Bob', file: 'bob', supportsSit: true },
  { id: 'bedhead', label: 'Despeinado', file: 'bedhead', gendered: true },
  { id: 'ponytail', label: 'Cola', file: 'ponytail', gendered: true },
  { id: 'long', label: 'Largo', file: 'long', gendered: true },
  { id: 'curly_long', label: 'Rizado', file: 'curly_long', gendered: true },
];

export const CLOTHING_STYLES: Opt[] = [
  { id: 'none', label: 'Sin ropa', supportsSit: true },
  // La única prenda de LPC compatible con sentarse es la camiseta femenina; se
  // ofrece a todos y por debajo se renderiza con la hoja femenina.
  { id: 'tshirt', label: 'T-Shirt (♀)', supportsSit: true },
  { id: 'shortsleeve', label: 'Camiseta' },
  { id: 'longsleeve', label: 'Manga larga' },
  { id: 'sleeveless', label: 'Sin mangas' },
  { id: 'vest', label: 'Chaleco' },
  { id: 'vest_open', label: 'Chaleco abierto' },
];

export const BEARD_STYLES: { id: string; label: string; file: string | null }[] = [
  { id: 'none', label: 'Sin barba', file: null },
  { id: '5oclock_shadow', label: 'Sombra', file: '5oclock_shadow' },
  { id: 'trimmed', label: 'Recortada', file: 'trimmed' },
  { id: 'basic', label: 'Básica', file: 'basic' },
  { id: 'medium', label: 'Mediana', file: 'medium' },
];

export const GLASSES_STYLES: { id: string; label: string; file: string | null }[] = [
  { id: 'none', label: 'Sin lentes', file: null },
  { id: 'nerd', label: 'Nerd', file: 'nerd' },
  { id: 'round', label: 'Redondos', file: 'round' },
  { id: 'sunglasses', label: 'Sol', file: 'sunglasses' },
  { id: 'halfmoon', label: 'Media luna', file: 'halfmoon' },
  { id: 'shades', label: 'Sombra', file: 'shades' },
];

export const SHOES_STYLES: Opt[] = [
  { id: 'none', label: 'Descalzo', supportsSit: true },
  { id: 'shoes2', label: 'Zapatos (sit)', supportsSit: true },
  { id: 'shoes', label: 'Zapatos' },
  { id: 'boots', label: 'Botas' },
  { id: 'sandals', label: 'Sandalias' },
  { id: 'slippers', label: 'Pantuflas' },
];

export type Direction = 'n' | 's' | 'e' | 'w';

export type CharacterAnimation =
  | 'idle'
  | 'walk'
  | 'cast'
  | 'thrust'
  | 'slash'
  | 'shoot'
  | 'hurt'
  | 'sit';

export type AnimationDef = {
  /** Fila por dirección, o una sola fila para todas (hurt solo mira al sur). */
  rows: Record<Direction, number> | number;
  frames: number;
  fps: number;
};

export const ANIMATIONS: Record<CharacterAnimation, AnimationDef> = {
  // El frame 0 de la fila de caminar es la pose de reposo.
  idle: { rows: { n: 8, w: 9, s: 10, e: 11 }, frames: 1, fps: 1 },
  walk: { rows: { n: 8, w: 9, s: 10, e: 11 }, frames: 9, fps: 8 },
  cast: { rows: { n: 0, w: 1, s: 2, e: 3 }, frames: 7, fps: 8 },
  thrust: { rows: { n: 4, w: 5, s: 6, e: 7 }, frames: 8, fps: 10 },
  slash: { rows: { n: 12, w: 13, s: 14, e: 15 }, frames: 6, fps: 12 },
  shoot: { rows: { n: 16, w: 17, s: 18, e: 19 }, frames: 13, fps: 12 },
  hurt: { rows: 20, frames: 6, fps: 6 },
  // Sentarse vive en el bloque extendido de la hoja universal (filas 30-33).
  sit: { rows: { n: 30, w: 31, s: 32, e: 33 }, frames: 3, fps: 4 },
};

/** Animaciones que se reproducen una vez y se quedan en el último frame. */
export const ONE_SHOT_ANIMATIONS = new Set<CharacterAnimation>([
  'sit',
  'cast',
  'thrust',
  'slash',
  'shoot',
  'hurt',
]);

/** Animaciones que viven más allá de la fila 20 de la hoja. */
export const EXTENDED_ANIMATIONS = new Set<CharacterAnimation>(['sit']);

/**
 * Variación de anchura por complexión. LPC solo trae 3 siluetas, así que los 5
 * niveles se diferencian estirando horizontalmente.
 */
export const WIDTH_FACTOR: Record<BodyType, number> = {
  muy_delgado: 0.86,
  delgado: 0.94,
  medio: 1,
  obeso: 1.08,
  muy_obeso: 1.2,
};

/**
 * Traduce la configuración a la lista ordenada de imágenes a apilar.
 *
 * El orden importa: cuerpo, pantalón, zapatos, ropa, cabeza, ojos, cejas,
 * barba, pelo, mochila y gafas. La mochila va sobre pelo y ropa (zPos 110 en
 * LPC) para que la correa se vea de frente y la mochila de espaldas.
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
  urls.push(glasses?.file ? `/character/glasses/${glasses.file}/${config.glassesColor}.png` : null);

  return urls.filter((u): u is string => typeof u === 'string');
}
