/**
 * EL TINTE DE LA SEGUNDA CAPA (Fernando, 2026-11-08: «que se marque más la opción seleccionada
 * rellenando de ese color suave la caja completa… para que sea el mismo color del siguiente menú»).
 * El color de lo elegido en la primera capa (Accesos) tiñe su caja y el fondo de la segunda, para que
 * se lean como una sola pieza. Reglas en `app/movimiento.css` (`.capa-uno`, `.capa-dos`).
 */
export const TINTE_PROGRESO = '#7c5ce0';
/** El morado de los iconos de los productos. */
export const TINTE_PRODUCTO = '#6d4bd8';
export const TINTE_CENTRALIZADO = '#c71585';

export function tinteDe(activo?: string): string {
  if (!activo) return TINTE_PROGRESO;
  if (activo === 'centralizado') return TINTE_CENTRALIZADO;
  if (activo.includes('/')) return TINTE_PRODUCTO;
  return TINTE_PROGRESO;
}
