/**
 * LOS TEMAS DEL PANEL (Fernando, 2026-10-29: «que existan varios temas»).
 *
 * Cada tema es una clase `tema-<id>` en el envoltorio `.corp` del panel; sus colores viven en
 * `app/temas.css`. `base` dice si además lleva `.dark`: los temas oscuros heredan TODAS las
 * correcciones del modo oscuro de `globals.css` (rojos, verdes, fondos `bg-white`…) y solo
 * cambian su paleta encima.
 *
 * `muestra` son los colores de la miniatura del selector (fondo, tarjeta, acento): un dato
 * para pintar el botón, no estilos del tema.
 */
export type TemaId = 'claro' | 'oscuro' | 'mixto' | 'corazon' | 'orquidea';

export interface DefinicionTema {
  id: TemaId;
  nombre: string;
  base: 'claro' | 'oscuro';
  muestra: { fondo: string; tarjeta: string; acento: string; ventana?: string };
}

export const TEMAS: DefinicionTema[] = [
  { id: 'claro', nombre: 'Claro', base: 'claro', muestra: { fondo: '#f3effb', tarjeta: '#ffffff', acento: '#7c5ce0' } },
  { id: 'oscuro', nombre: 'Oscuro', base: 'oscuro', muestra: { fondo: '#0d0a1a', tarjeta: '#17122b', acento: '#8b5cf6' } },
  // Claro para el fondo y oscuro para lo que flota encima: paneles, ventanas y menús.
  { id: 'mixto', nombre: 'Mixto', base: 'claro', muestra: { fondo: '#f3effb', tarjeta: '#ffffff', acento: '#7c5ce0', ventana: '#17122b' } },
  // El corazón del grupo: rojo sangre sobre una noche granate.
  { id: 'corazon', nombre: 'Corazón', base: 'oscuro', muestra: { fondo: '#12060a', tarjeta: '#210c12', acento: '#e11d48' } },
  // #C71585 (Fernando) sobre un rosa casi blanco.
  { id: 'orquidea', nombre: 'Orquídea', base: 'claro', muestra: { fondo: '#fbeef6', tarjeta: '#ffffff', acento: '#C71585' } },
];

export const TEMA_POR_DEFECTO: TemaId = 'claro';

export function definicionTema(id: string | null | undefined): DefinicionTema | undefined {
  return TEMAS.find((t) => t.id === id);
}
