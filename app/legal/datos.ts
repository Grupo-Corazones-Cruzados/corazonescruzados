/**
 * IDENTIDAD LEGAL DE GCC — definición ÚNICA para todas las páginas legales.
 *
 * Los valores salen del certificado de RUC del SRI, no de la memoria de nadie:
 * ver `documentos-negocio/DATOS-NEGOCIO.md` (el PDF original está fuera de git por
 * llevar datos personales).
 *
 * Estaban duplicados como constantes sueltas dentro de `app/legal/page.tsx`. Con dos
 * páginas legales, una dirección corregida en un sitio y no en el otro es una
 * contradicción publicada — y estas páginas las lee un revisor de Meta.
 */

/** Razón social. NO es «Grupo Corazones Cruzados»: eso es el nombre comercial. */
export const RESPONSABLE = 'Luis Fernando González Muyulema';

/** Nombre comercial del establecimiento 001, registrado en el SRI el 2026-08-01. */
export const NOMBRE_COMERCIAL = 'Grupo Corazones Cruzados';

export const RUC = '0930095922001';

/**
 * Domicilio tributario tal como consta en el certificado del SRI.
 * Ojo: «Tabacundo» es la CALLE, no la ciudad — antes decía «Tabacundo, código postal
 * 090102», que confundía la calle con un cantón de Pichincha e inventaba un código
 * postal que no consta en ningún documento.
 */
export const DIRECCION =
  'Barrio 7 Lagos, calle Tabacundo #12 e intersección Guasmo Central, parroquia Ximena, Guayaquil, Ecuador';

export const CONTACTO = 'lfgonzalezm0@grupocc.org';
