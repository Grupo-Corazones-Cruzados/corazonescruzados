/**
 * Saneado de TEXTO para los XML del SRI (factura, nota de crédito, …).
 *
 * El SRI valida el comprobante contra su XSD ANTES de recibirlo. Si un campo de texto
 * excede la longitud declarada, DEVUELVE el comprobante con:
 *
 *   ARCHIVO NO CUMPLE ESTRUCTURA XML
 *   cvc-maxLength-valid: Value '…' with length = '327' is not facet-valid
 *   with respect to maxLength '300' for type 'descripcion'
 *
 * Pasó en producción el 2026-08-04 con la factura 001-001-000000075: las 6 descripciones
 * venían de una cotización generada por el agente y medían entre 327 y 416 caracteres.
 */

/** Longitudes máximas de los XSD del SRI, por campo. */
export const SRI_MAX = {
  razonSocial: 300,
  nombreComercial: 300,
  dirMatriz: 300,
  dirEstablecimiento: 300,
  razonSocialComprador: 300,
  direccionComprador: 300,
  descripcion: 300,
  codigoPrincipal: 25,
  codigoAuxiliar: 25,
  motivo: 300,
  campoAdicionalNombre: 300,
  campoAdicionalValor: 300,
} as const;

/**
 * Escapa TEXTO DE UN NODO (character data).
 *
 * ⚠ Solo `&`, `<` y `>`. **NUNCA `'` ni `"`**, aunque XML los admita escapados: en texto de
 * nodo no hacen ninguna falta (solo importan dentro de un valor de atributo) y el
 * canonicalizador de `ec-sri-invoice-signer` los **re-escapa**, convirtiendo `&apos;` en
 * `&amp;apos;`. Entonces la librería calcula el digest sobre `y &amp;apos;Empacar…` mientras
 * el SRI lo calcula sobre `y 'Empacar…` → los hashes no cuadran y el SRI responde
 * **FIRMA INVALIDA (firma y/o certificados alterados)**.
 *
 * Pasó en producción el 2026-08-04 con la primera descripción que llevó un apóstrofo
 * («barrido final y 'Empacar y Facturar'»). Comprobado ejecutando la c14n de la librería
 * contra la canonicalización correcta: con `&apos;` no cuadran; con el apóstrofo literal, sí.
 */
export function escapeXmlText(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapa un VALOR DE ATRIBUTO. Los atributos se emiten entre comillas dobles, así que se
 * escapa `"` pero no `'`. (`&quot;` en atributo sí lo canonicaliza bien la librería.)
 */
export function escapeXmlAttr(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/**
 * Prepara un valor para un campo de texto del XML del SRI: colapsa espacios y saltos de
 * línea, recorta, **trunca a `max`** y escapa.
 *
 * ⚠ El orden importa: se trunca ANTES de escapar porque el validador del SRI decodifica
 * las entidades y cuenta los caracteres reales — `&amp;` cuenta 1, no 5. Truncar después
 * de escapar contaría de más y, peor, podría partir una entidad por la mitad.
 */
export function sriText(value: string | null | undefined, max: number): string {
  return escapeXmlText(truncar(value, max));
}

/** Igual que `sriText` pero para un valor de atributo. */
export function sriAttr(value: string | null | undefined, max: number): string {
  return escapeXmlAttr(truncar(value, max));
}

function truncar(value: string | null | undefined, max: number): string {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  // Corta y remata con «…» (1 carácter) sin dejar puntuación colgando.
  return s.slice(0, max - 1).replace(/[\s,;:.·\-–—]+$/, '') + '…';
}

/** ¿Este texto se va a truncar? Para avisar en la UI antes de emitir. */
export function sriTextOverflows(value: string | null | undefined, max: number): boolean {
  return String(value ?? '').replace(/\s+/g, ' ').trim().length > max;
}
