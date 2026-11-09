/**
 * Régimen y estado de una cuenta de emisor — módulo PURO (sin base de datos): lo importan el servidor
 * (`emisor.ts`) y las pantallas (Configuración › Facturación, Admin › Emisores).
 */

export type Regimen = 'rimpe_negocio_popular' | 'rimpe_emprendedor' | 'general';
export type EstadoEmisor = 'borrador' | 'en_pruebas' | 'activo' | 'suspendido';

/**
 * Leyendas literales de la Ficha Técnica del SRI (ANEXO 22). No son intercambiables: la de Negocio Popular mide
 * 45 caracteres, con tilde. Van en `infoAdicional` (`regimen`), no en `<contribuyenteRimpe>`: ver
 * `xml-builder.ts` y la nota sri-ec-rimpe-negocio-popular.
 */
export const LEYENDA_REGIMEN: Record<Regimen, string> = {
  rimpe_negocio_popular: 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE',
  rimpe_emprendedor: 'CONTRIBUYENTE RÉGIMEN RIMPE',
  general: '',
};
