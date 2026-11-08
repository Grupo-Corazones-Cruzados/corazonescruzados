/**
 * El tema de los productos, para lo que no lee CSS: la barra del navegador y del teléfono
 * (`themeColor`), el manifiesto de la app instalada y el papel de <html> antes de pintar.
 *
 * Es el mismo de `globals.css` (`@theme`): WhatsApp de escritorio en oscuro, único para todos
 * los clientes desde 2026-11-08. El cliente ya no elige color ni tema; las columnas
 * `color_acento` y `tema` del inquilino quedan en la base sin uso.
 */
export const TEMA = { fondo: '#0b0b0b', tarjeta: '#161717', texto: '#e9edef', acento: '#21c063' } as const;

/**
 * La dirección del logo del inquilino. El subido (en la base, versionado) manda; si no hay,
 * el antiguo por dirección (de antes de 2026-11-08), que ya no se puede escribir a mano.
 */
export function urlLogo(i: { slug: string; logoVersion: number; logoUrl: string | null }): string | null {
  return i.logoVersion > 0 ? `/${i.slug}/logo?v=${i.logoVersion}` : i.logoUrl;
}
