import { Briefcase, Dumbbell, Brain, Users, type LucideIcon } from 'lucide-react';

/**
 * Icono por DIMENSIÓN del desarrollo (laboral · corporal · mental · social).
 *
 * Definición ÚNICA. Este mapa estaba copiado literalmente en `mi-dia/page.tsx`,
 * `HorarioDeVidaSystem.tsx` y `KnowledgeGraph.tsx`; los gráficos de Pensamientos habrían
 * sido la cuarta copia. Vive aquí (y no en `lib/centralized/apoyo.ts`) para no arrastrar
 * `lucide-react` a los módulos de servidor que importan las dimensiones.
 *
 * El icono NO es decorativo: es el canal de identidad que acompaña al color. La paleta de
 * dimensiones no supera la separación para daltonismo (mental #ec4899 ↔ corporal #14b8a6,
 * ΔE 3.7 en deuteranopia), así que en leyendas y gráficos la categoría debe distinguirse
 * también por icono y/o forma, nunca solo por color.
 */
export const DIMENSION_ICON: Record<string, LucideIcon> = {
  laboral: Briefcase,
  corporal: Dumbbell,
  mental: Brain,
  social: Users,
};

/** Forma del marcador por dimensión, para los gráficos (2º canal no cromático). */
export type MarkShape = 'circle' | 'square' | 'triangle' | 'diamond';
export const DIMENSION_SHAPE: Record<string, MarkShape> = {
  laboral: 'circle',
  corporal: 'square',
  mental: 'triangle',
  social: 'diamond',
};
