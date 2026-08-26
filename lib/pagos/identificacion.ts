/**
 * EL TIPO DE IDENTIFICACIÓN SE DEDUCE, NO SE PREGUNTA — módulo PURO.
 *
 * Fernando, 2026-08-26: *«en vez de preguntar RUC, o cédula, o identificación externa,
 * preguntemos el país en un selector de países… si es de Ecuador pone su número de
 * identificación, y si termina en 001 es porque es un RUC, y si no es porque es una cédula,
 * y si escogió otro país que no sea Ecuador cogemos esa factura como identificación
 * externa»*.
 *
 * El porqué es bueno: **«tipo de identificación» es vocabulario del SRI, no del cliente.**
 * Un comprador no tiene que saber que su número es un «04» o un «05» — sabe de qué país es y
 * cuál es su número. La traducción a los códigos del SRI es trabajo nuestro.
 *
 * ⚠️ Y ESTA DEDUCCIÓN CORRE EN EL SERVIDOR. El navegador la repite para poder enseñar «se
 * registrará como RUC» mientras el cliente escribe, pero **el que decide es el servidor**:
 * si aceptáramos el `id_type` que llegue del formulario, cualquiera podría mandar un cobro
 * con el tipo que le apetezca y el comprobante saldría mal emitido.
 */

/** El país cuyo número sí sabemos interpretar. Los demás van como identificación del exterior. */
export const PAIS_LOCAL = 'Ecuador';

export type TipoIdentificacion = {
  /** Código de la tabla 6 de la Ficha Técnica del SRI. */
  idType: '04' | '05' | '08';
  /** Cómo se le llama en la pantalla, para que el cliente vea qué se dedujo. */
  etiqueta: string;
};

export type ResultadoIdentificacion =
  | { ok: true; valor: TipoIdentificacion }
  | { ok: false; error: string };

/**
 * Deduce el tipo de identificación del SRI a partir del país y el número.
 *
 * ⚠️ **`07` (Consumidor final) ya no se emite por esta vía.** Fernando lo quitó del
 * formulario el 2026-08-26: en un cobro en línea siempre hay alguien identificado al otro
 * lado, y una factura a consumidor final por un proyecto o una suscripción no le sirve al
 * cliente —no le da crédito tributario ni le justifica el gasto—. El canal manual lo sigue
 * admitiendo, que es donde tiene sentido.
 */
export function deducirIdentificacion(pais: string, numeroBruto: string): ResultadoIdentificacion {
  const p = (pais || '').trim();
  const numero = (numeroBruto || '').trim();

  if (!p) return { ok: false, error: 'Elige tu país.' };
  if (!numero) return { ok: false, error: 'Escribe tu número de identificación.' };

  if (p !== PAIS_LOCAL) {
    // Fuera de Ecuador el formato lo pone cada país («3-101-619800» en Costa Rica), así que
    // solo se comprueba que sea algo razonable. Exigirle dígitos ecuatorianos dejaría fuera
    // justo al cliente extranjero.
    if (numero.length < 3 || numero.length > 20) {
      return { ok: false, error: 'La identificación debe tener entre 3 y 20 caracteres.' };
    }
    return { ok: true, valor: { idType: '08', etiqueta: 'Identificación del exterior' } };
  }

  if (!/^\d+$/.test(numero)) {
    return { ok: false, error: 'Tu identificación debe tener solo números.' };
  }

  // La regla de Fernando, con la comprobación de longitud que la hace segura: un RUC
  // ecuatoriano tiene 13 dígitos y una cédula 10. Sin esa comprobación, un «1001» pasaría
  // por RUC y el SRI rechazaría el comprobante después de haber cobrado.
  if (numero.endsWith('001')) {
    if (numero.length !== 13) {
      return { ok: false, error: 'Un RUC tiene 13 dígitos y termina en 001. Revisa tu número.' };
    }
    return { ok: true, valor: { idType: '04', etiqueta: 'RUC' } };
  }

  if (numero.length !== 10) {
    return { ok: false, error: 'Una cédula tiene 10 dígitos; un RUC, 13 y termina en 001.' };
  }
  return { ok: true, valor: { idType: '05', etiqueta: 'Cédula' } };
}

/** Lo que la pantalla enseña mientras se escribe. Nunca lanza: sin dato aún, no dice nada. */
export function etiquetaProvisional(pais: string, numero: string): string | null {
  if (!pais || !numero) return null;
  const r = deducirIdentificacion(pais, numero);
  return r.ok ? r.valor.etiqueta : null;
}
