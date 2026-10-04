import { chatJSON } from '@/lib/ia/openai';

/**
 * Admin ▸ Prompts ▸ «Validar contradicciones» (Fernando, 2026-10-04): lee el documento
 * COMPLETO de un proyecto y dice si un texto nuevo choca con lo que el documento ya decide
 * —si sí o no, dónde y por qué—. Sin texto nuevo, revisa el documento contra sí mismo.
 *
 * Una sola llamada a `chatJSON` (JSON, sin herramientas: no hace falta `/v1/responses`).
 * El documento va en el mensaje del sistema, delante, para que el caché por prefijo entre
 * cuando se valida varias veces el mismo documento.
 */

/** Un texto nuevo más largo que esto ya no es «un texto», es otro documento. */
export const MAX_TEXTO_NUEVO = 20_000;

export interface Contradiccion {
  /** Sección del documento (el encabezado más cercano por encima), o «Sin sección». */
  ubicacion: string;
  /** Cita LITERAL del documento con la que choca. Sirve para localizarla en la hoja. */
  citaDocumento: string;
  /** Cita literal del texto nuevo (o, sin texto nuevo, del otro pasaje del documento). */
  citaNueva: string;
  /** Por qué no pueden ser ciertas las dos a la vez. */
  explicacion: string;
}

export interface ResultadoContradicciones {
  hayContradiccion: boolean;
  resumen: string;
  contradicciones: Contradiccion[];
  /** `texto` = se comparó un texto nuevo · `documento` = el documento contra sí mismo. */
  modo: 'texto' | 'documento';
}

const REGLAS = `Eres el revisor de decisiones de la documentación de un proyecto de software. El documento recoge cómo debe funcionar el sistema: decisiones, reglas de negocio, correcciones y pendientes.

QUÉ ES UNA CONTRADICCIÓN
- Dos afirmaciones que NO pueden ser ciertas a la vez: una decide, exige, prohíbe o describe algo que la otra niega o hace imposible (valores, límites, quién puede hacer qué, qué pasa en un caso, orden de pasos, estados, nombres de lo mismo con reglas distintas).
- NO es contradicción: ampliar, detallar, dar un ejemplo, añadir un caso nuevo que el documento no trata, repetir lo mismo con otras palabras, ni una pregunta o pendiente abierto.
- Si el propio documento ya marca algo como corregido, derogado, sustituido o «antes…/ahora…», manda lo VIGENTE: comparar contra lo derogado no es contradicción.
- Una regla general («todo», «siempre», «nunca», «solo», «cada») SÍ queda contradicha por un caso concreto que la incumple, salvo que el documento lo presente expresamente como excepción («salvo», «excepto», «menos»).
- No inventes contradicciones: cada una tiene que poder señalarse con dos citas que, leídas juntas, no puedan ser ciertas a la vez.

CÓMO RESPONDER
- "citaDocumento" y "citaNueva" son copias LITERALES, letra por letra, de un fragmento del texto (sin los símbolos de Markdown como #, *, |, >, \`). Máximo 300 caracteres cada una. Se usan para encontrar el pasaje, así que no las resumas ni las corrijas.
- "ubicacion" es el título del encabezado (#, ##, ###) más cercano por encima de la citaDocumento, tal cual está escrito; si no hay ninguno, "Sin sección".
- "explicacion": una o dos frases, en español, que digan qué decide cada parte y por qué no caben juntas.
- "resumen": una frase. Si no hay contradicciones, dilo claro.

Responde ÚNICAMENTE con un objeto JSON con esta forma:
{"hayContradiccion": boolean, "resumen": string, "contradicciones": [{"ubicacion": string, "citaDocumento": string, "citaNueva": string, "explicacion": string}]}`;

export async function validarContradicciones(p: {
  titulo: string;
  documentoMd: string;
  textoNuevo: string;
}): Promise<ResultadoContradicciones> {
  const modo: ResultadoContradicciones['modo'] = p.textoNuevo.trim() ? 'texto' : 'documento';

  const system = `${REGLAS}

=== DOCUMENTO DEL PROYECTO «${p.titulo}» (Markdown) ===
${p.documentoMd.trim() || '(vacío)'}
=== FIN DEL DOCUMENTO ===`;

  const user = modo === 'texto'
    ? `Este es el TEXTO NUEVO que se quiere incluir en el documento. Puede que ya esté escrito dentro del documento: si es así, no lo compares consigo mismo, compáralo con el resto.

=== TEXTO NUEVO ===
${p.textoNuevo.trim()}
=== FIN DEL TEXTO NUEVO ===

¿Contradice el texto nuevo alguna decisión del documento? En cada contradicción, "citaNueva" sale del texto nuevo y "citaDocumento" del documento.`
    : `No hay texto nuevo: revisa el documento COMPLETO contra sí mismo. Recorre UNA POR UNA sus decisiones y reglas, y compara cada una con todas las demás, también las de otras secciones. ¿Hay dos pasajes que se contradigan? En cada contradicción, "citaDocumento" es el pasaje que va primero en el documento y "citaNueva" el que va después.`;

  const r = await chatJSON<any>({
    system,
    user,
    // El razonamiento cuenta dentro del techo: con un documento largo y esfuerzo alto, 8.000
    // se quedaban cortos y el modelo devolvía vacío.
    maxTokens: 32_000,
    esfuerzo: 'high',
    etiqueta: 'contradicciones',
  });

  const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const contradicciones: Contradiccion[] = (Array.isArray(r?.contradicciones) ? r.contradicciones : [])
    .map((c: any) => ({
      // El modelo a veces copia el encabezado con sus almohadillas («## Pagos»).
      ubicacion: texto(c?.ubicacion, 200).replace(/^#+\s*/, '') || 'Sin sección',
      citaDocumento: texto(c?.citaDocumento, 400),
      citaNueva: texto(c?.citaNueva, 400),
      explicacion: texto(c?.explicacion, 1200),
    }))
    .filter((c: Contradiccion) => c.explicacion && (c.citaDocumento || c.citaNueva))
    .slice(0, 20);

  // El veredicto sale de la lista, no de la bandera: un «sí» sin ninguna contradicción
  // concreta no le sirve a nadie, y un «no» con contradicciones sería mentir.
  const hayContradiccion = contradicciones.length > 0;
  const resumen = texto(r?.resumen, 600)
    || (hayContradiccion ? `Hay ${contradicciones.length} contradicción(es).` : 'No hay contradicciones.');
  return { hayContradiccion, resumen, contradicciones, modo };
}
