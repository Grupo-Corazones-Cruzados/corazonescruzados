import { conBase } from '@/lib/base';

/**
 * El tema de los productos, para lo que no lee CSS: la barra del navegador y del teléfono
 * (`themeColor`), el manifiesto de la app instalada y el papel de <html> antes de pintar.
 *
 * Es el mismo de `globals.css` (`@theme`): WhatsApp de escritorio en oscuro, único para todos
 * los clientes desde 2026-11-08 (el de Automatizaciones de WhatsApp). El negocio ya no elige
 * color ni tema; las columnas `color_acento` y `tema` del inquilino quedan en la base sin uso.
 */
export const TEMA = { fondo: '#0b0b0b', tarjeta: '#161717', texto: '#e9edef', acento: '#21c063' } as const;

/**
 * Una huella corta del logo subido: va en la URL (`?v=`) para que el navegador pueda guardarlo
 * en caché sin quedarse con el viejo cuando se cambia.
 */
function huella(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 7) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return ((h >>> 0) ^ texto.length).toString(36);
}

/**
 * La dirección del logo del negocio. Desde 2026-11-08 se SUBE como archivo y se guarda como
 * `data:` en la misma columna `logo_url` (Cloudinary no está en producción); se sirve desde
 * `/<slug>/logo` para no meter cientos de KB en cada página. Una dirección antigua se usa tal cual.
 */
export function urlLogo(i: { slug: string; logoUrl: string | null }): string | null {
  if (!i.logoUrl) return null;
  return i.logoUrl.startsWith('data:') ? conBase(`/${i.slug}/logo?v=${huella(i.logoUrl)}`) : i.logoUrl;
}
