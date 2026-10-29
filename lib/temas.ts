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
export type TemaId = 'claro' | 'oscuro' | 'mixto' | 'corazon' | 'orquidea' | 'electrico' | 'navidad' | 'videojuego' | 'negro';

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
  // El corazón del grupo: rojo sangre sobre una noche granate, paneles en grafito.
  { id: 'corazon', nombre: 'Corazón', base: 'oscuro', muestra: { fondo: '#12060a', tarjeta: '#26262b', acento: '#e11d48' } },
  // #C71585 (Fernando) sobre un rosa casi blanco.
  { id: 'orquidea', nombre: 'Orquídea', base: 'claro', muestra: { fondo: '#fbeef6', tarjeta: '#ffffff', acento: '#C71585' } },
  // Azul eléctrico sobre la noche de una ciudad, paneles en grafito.
  { id: 'electrico', nombre: 'Eléctrico', base: 'oscuro', muestra: { fondo: '#040a1c', tarjeta: '#1f2229', acento: '#1f5bff' } },
  // Nieve y pino, con los botones en rojo de Navidad.
  { id: 'navidad', nombre: 'Navidad', base: 'claro', muestra: { fondo: '#eef3ef', tarjeta: '#ffffff', acento: '#c1121f', ventana: '#0f2a1d' } },
  // Máquina recreativa: letra pixel, esquinas rectas, verde neón y magenta.
  { id: 'videojuego', nombre: 'Videojuego', base: 'oscuro', muestra: { fondo: '#07061a', tarjeta: '#1f1e31', acento: '#4ade80' } },
  // Negro puro y blanco, sin color de marca.
  { id: 'negro', nombre: 'Negro', base: 'oscuro', muestra: { fondo: '#000000', tarjeta: '#171717', acento: '#fafafa' } },
];

export const TEMA_POR_DEFECTO: TemaId = 'claro';

export function definicionTema(id: string | null | undefined): DefinicionTema | undefined {
  return TEMAS.find((t) => t.id === id);
}
