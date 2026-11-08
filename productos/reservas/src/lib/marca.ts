/**
 * El tema de los productos, para lo que no lee CSS: la barra del navegador y del teléfono
 * (`themeColor`), el manifiesto de la app instalada y el papel de <html> antes de pintar.
 *
 * Es el mismo de `globals.css` (`@theme`): WhatsApp de escritorio en oscuro, único para todos
 * los alojamientos desde 2026-11-08 (el de Automatizaciones, que es la referencia). El cliente
 * ya no elige color ni tema; las columnas `color_acento` y `tema` del inquilino quedan en la
 * base sin uso. Antes aquí se calculaban los cuatro colores del acento a partir del que elegía
 * cada hotel: eso se fue con el selector.
 */
export const TEMA = { fondo: '#0b0b0b', tarjeta: '#161717', texto: '#e9edef', acento: '#21c063' } as const;
