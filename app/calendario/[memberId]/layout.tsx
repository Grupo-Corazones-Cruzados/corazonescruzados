import type { ReactNode } from 'react';
import type { Viewport } from 'next';

/**
 * LA AGENDA PÚBLICA NO SE DIBUJA BAJO LAS BARRAS DEL TELÉFONO (Fernando, iPhone, navegador
 * de WhatsApp, 2026-10-31: «un pedazo se requiere deslizarse hacia abajo para poder verlo»).
 *
 * La raíz pone `viewportFit: 'cover'` para la app instalada, que ocupa la pantalla entera. Este
 * enlace se abre siempre en un navegador, y ahí `cover` estira la página por debajo de la hora
 * (la franja negra de arriba) y de la barra inferior del navegador (+ y ^): la columna de alto
 * fijo medía la pantalla ENTERA y la barra tapaba el final de la agenda y «Agendar espacio».
 * Con `auto` la página empieza bajo la hora y termina encima de esa barra.
 *
 * Los demás campos van escritos porque el `viewport` de una ruta se combina con el de la raíz.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'auto',
};

export default function CalendarioPublicoLayout({ children }: { children: ReactNode }) {
  return children;
}
