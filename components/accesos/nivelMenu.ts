/**
 * DE DÓNDE SE VIENE, para que el menú lateral «avance» (Fernando, 2026-11-08: «que se sienta que uno
 * avanza al seleccionar Progreso y pasa al submenú»). Accesos es el nivel de arriba; Progreso, el de
 * debajo. El layout del panel anota cada ruta DESPUÉS de montar lo nuevo (`anotarRuta`), así que un
 * menú que se monta lee todavía la ruta anterior: el de Progreso entra desde la derecha si se venía de
 * Accesos (`menu-avanza`) y el de Accesos, desde la izquierda si se venía de Progreso (`menu-vuelve`).
 * Clases en `app/movimiento.css`. En memoria: tras recargar no hay animación, que es lo correcto.
 */
let ultimaRuta: string | null = null;

export function anotarRuta(ruta: string) { ultimaRuta = ruta; }

const esAccesos = (r: string) => r === '/dashboard/accesos';
const esSeccionAparte = (r: string) =>
  ['/dashboard/accesos', '/dashboard/tools', '/dashboard/centralized', '/dashboard/admin/espacio', '/dashboard/admin/espacio-app', '/dashboard/admin/gumdramon-app']
    .some((s) => r === s || r.startsWith(s + '/'));

export function movimientoDelMenu(nivel: 'accesos' | 'progreso'): 'menu-avanza' | 'menu-vuelve' | '' {
  if (typeof window === 'undefined' || !ultimaRuta) return '';
  if (nivel === 'progreso' && esAccesos(ultimaRuta)) return 'menu-avanza';
  if (nivel === 'accesos' && !esSeccionAparte(ultimaRuta)) return 'menu-vuelve';
  return '';
}
