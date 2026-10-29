/**
 * DE QUÉ PESTAÑA SE VIENE — memoria de la navegación del sitio público (Fernando, 2026-10-29).
 *
 * La transición entre Inicio, Soluciones, Clientes y Desarrollo Humano necesita saber de dónde
 * se viene: la cápsula de la cabecera se desliza DESDE la pestaña anterior, y el cuerpo entra
 * desde el lado hacia el que se avanzó. Vive en el módulo (no en un estado de React) porque la
 * cabecera se REMONTA al pasar de la portada (`app/page.tsx`) al marco de `app/(sitio)` y
 * viceversa; el módulo sobrevive a la navegación de cliente. En el servidor no se usa.
 *
 * La actualiza la cabecera en su efecto, DESPUÉS de pintar; así, durante el render de la página
 * nueva, `rutaAnterior()` aún es la de antes. Atrás/adelante del navegador funcionan igual.
 */

import { NAVEGACION } from '@/lib/sitio/contenido';

let anterior: string | null = null;

export function rutaAnterior() {
  return anterior;
}

export function recordarRuta(ruta: string) {
  anterior = ruta;
}

/** La pestaña del menú a la que pertenece una ruta (`/clientes/x` → `/clientes`), o null. */
export function pestanaDe(ruta: string | null): string | null {
  if (!ruta) return null;
  const n = NAVEGACION.find((p) => (p.href === '/' ? ruta === '/' : ruta.startsWith(p.href)));
  return n ? n.href : null;
}

/** Posición de la pestaña en el menú (de izquierda a derecha), o -1. */
export function indicePestana(ruta: string | null) {
  const p = pestanaDe(ruta);
  return p ? NAVEGACION.findIndex((n) => n.href === p) : -1;
}
