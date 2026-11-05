import { Braces, Cog, Flag, GitBranch, MousePointerClick, Play, Plug, Repeat2, type LucideIcon } from 'lucide-react';
import type { TipoNodo } from './colocar';

/**
 * Cada pieza del catálogo tiene su dibujo: si falta una, esto no compila. Aparte del lienzo, para no traer React Flow a la página.
 * ⚠️ El radio va aparte, en `style`, y no como `rounded-lg`: el tema trata `bg-digi-card border rounded-lg` como tarjeta y le impone su borde y su sombra.
 */
export const PIEZAS: Record<TipoNodo, { Icono: LucideIcon; texto: string; borde: string; radio: number }> = {
  inicio: { Icono: Play, texto: 'text-green-400', borde: 'border-green-400', radio: 999 },
  accion: { Icono: MousePointerClick, texto: 'text-accent', borde: 'border-accent', radio: 10 },
  proceso: { Icono: Cog, texto: 'text-digi-muted', borde: 'border-digi-muted', radio: 10 },
  decision: { Icono: GitBranch, texto: 'text-amber-400', borde: 'border-amber-400', radio: 0 },
  bucle: { Icono: Repeat2, texto: 'text-blue-400', borde: 'border-blue-400', radio: 10 },
  dato: { Icono: Braces, texto: 'text-digi-muted', borde: 'border-digi-muted border-dashed', radio: 3 },
  integracion: { Icono: Plug, texto: 'text-orange-400', borde: 'border-orange-400', radio: 10 },
  fin: { Icono: Flag, texto: 'text-digi-text', borde: 'border-digi-text', radio: 999 },
};
