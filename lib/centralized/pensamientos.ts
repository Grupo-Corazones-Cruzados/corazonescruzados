import { DIMENSIONS } from '@/lib/centralized/apoyo';

/**
 * Constantes PURAS del módulo Pensamientos (sin acceso a base de datos), para que las pueda
 * importar tanto el servidor como los componentes de cliente. La capa de datos vive en
 * `pensamientos-db.ts`. Mismo corte que `apoyo.ts` / `apoyo-db.ts`.
 */

/** Categorías válidas = las dimensiones del desarrollo (fuente única en `apoyo.ts`). */
export const CATEGORIES: string[] = DIMENSIONS.map((d) => d.key);
export const CATEGORIES_SET = new Set(CATEGORIES);

/** Zona horaria de la organización. El contenedor de Railway corre en UTC. */
export const TZ = 'America/Guayaquil';

/**
 * INTENSIDAD de un pensamiento, derivada de cuánto texto se escribió. Definición ÚNICA:
 * la usan el compositor, la tarjeta y los gráficos, para que "intensidad" signifique
 * exactamente lo mismo en toda la app.
 */
export const INTENSITY_BANDS = [
  { key: 'breve', label: 'Breve', min: 0, color: '#94a3b8' },
  { key: 'media', label: 'Media', min: 280, color: '#38bdf8' },
  { key: 'alta', label: 'Alta', min: 900, color: '#a855f7' },
  { key: 'profunda', label: 'Profunda', min: 2500, color: '#f43f5e' },
] as const;

export type IntensityKey = (typeof INTENSITY_BANDS)[number]['key'];

export function intensityOf(chars: number): { key: IntensityKey; label: string; color: string } {
  let out: (typeof INTENSITY_BANDS)[number] = INTENSITY_BANDS[0];
  for (const b of INTENSITY_BANDS) if (chars >= b.min) out = b;
  return { key: out.key, label: out.label, color: out.color };
}
