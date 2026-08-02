/**
 * Las TRES herramientas del agente. Son la decisión, no una fuente de información.
 *
 * Se llaman con `tool_choice: {type:'any'}`, así que el modelo ejecuta **siempre
 * exactamente una**. Ninguna devuelve datos que el modelo vaya a leer después, y por eso
 * **no hay bucle de tool-use**: un bucle solo sumaría turnos, latencia y costo.
 *
 * Se probó la alternativa —una cadena de clasificadores— y producía falsos positivos.
 * Decisión cerrada; no re-litigar.
 *
 * `strict: true` va **en la definición de la herramienta**, no en `tool_choice`, y exige
 * `additionalProperties: false` + `required`. Con eso el esquema se valida de verdad y el
 * modelo no puede inventarse un campo.
 *
 * Módulo puro: sin red ni base de datos.
 */

export type NombreHerramienta = 'responder' | 'no_responder' | 'escalar_a_humano';

export interface Herramienta {
  name: NombreHerramienta;
  description: string;
  strict: true;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
    additionalProperties: false;
  };
}

export const HERRAMIENTAS: Herramienta[] = [
  {
    name: 'responder',
    description:
      'Envía una respuesta al contacto por WhatsApp. Úsala cuando puedas contestar con el conocimiento disponible.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        texto: {
          type: 'string',
          description:
            'El mensaje que se le envía al contacto. Breve (2 a 4 líneas), sin emojis, en el idioma en que escribió.',
        },
      },
      required: ['texto'],
      additionalProperties: false,
    },
  },
  {
    name: 'no_responder',
    description:
      'No contesta nada. Úsala solo con publicidad, cadenas, estafas, contenido ofensivo o mensajes sin ninguna intención.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          description: 'Por qué no se responde. Nota interna: el contacto no la ve.',
        },
      },
      required: ['motivo'],
      additionalProperties: false,
    },
  },
  {
    name: 'escalar_a_humano',
    description:
      'Pasa la conversación a una persona del equipo y apaga el bot en este chat. Úsala si falta el dato, si hay un reclamo, o si el contacto pide hablar con alguien.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          description: 'Por qué se escala. Nota interna para el operador que reciba el chat.',
        },
        aviso: {
          type: 'string',
          description:
            'Mensaje breve avisando al contacto de que un compañero le escribirá. Cadena vacía para no enviarle nada.',
        },
      },
      required: ['motivo', 'aviso'],
      additionalProperties: false,
    },
  },
];

/** La decisión ya interpretada, lista para que el runner actúe. */
export type Decision =
  | { tipo: 'responder'; texto: string }
  | { tipo: 'no_responder'; motivo: string }
  | { tipo: 'escalar_a_humano'; motivo: string; aviso: string };

/**
 * Lee la decisión de la respuesta del modelo.
 *
 * ⚠️ Hay que comprobar `stop_reason === 'refusal'` **ANTES** de leer `content`: en una
 * negativa el contenido puede venir vacío o a medias, y `stop_details` puede ser `null`
 * incluso entonces — así que se ramifica por `stop_reason`, nunca por `stop_details`.
 *
 * ⚠️ Con el razonamiento apagado, la familia Claude 5 puede escribir la llamada a la
 * herramienta como **texto visible**; esa llamada nunca se ejecuta y no hay error. Aquí
 * eso se detecta —no hay bloque `tool_use`— y se devuelve un fallo explícito en vez de
 * dejar la conversación en silencio.
 */
export function leerDecision(respuesta: any):
  | { ok: true; decision: Decision }
  | { ok: false; motivo: string } {
  if (!respuesta) return { ok: false, motivo: 'La API no devolvió respuesta' };

  if (respuesta.stop_reason === 'refusal') {
    const categoria = respuesta.stop_details?.category ?? 'sin categoría';
    return { ok: false, motivo: `El modelo rechazó la petición (${categoria})` };
  }

  const bloques: any[] = Array.isArray(respuesta.content) ? respuesta.content : [];
  const uso = bloques.find((b) => b?.type === 'tool_use');

  if (!uso) {
    if (respuesta.stop_reason === 'max_tokens') {
      return { ok: false, motivo: 'La respuesta se cortó por max_tokens antes de decidir' };
    }
    // El fallo silencioso descrito arriba: texto en vez de llamada.
    const texto = bloques.find((b) => b?.type === 'text')?.text?.slice(0, 200);
    return {
      ok: false,
      motivo: texto
        ? `El modelo escribió texto en vez de usar una herramienta: "${texto}"`
        : 'El modelo no eligió ninguna herramienta',
    };
  }

  const entrada = uso.input ?? {};
  switch (uso.name) {
    case 'responder': {
      const texto = String(entrada.texto ?? '').trim();
      if (!texto) return { ok: false, motivo: 'La herramienta responder vino sin texto' };
      return { ok: true, decision: { tipo: 'responder', texto } };
    }
    case 'no_responder':
      return {
        ok: true,
        decision: { tipo: 'no_responder', motivo: String(entrada.motivo ?? 'sin motivo') },
      };
    case 'escalar_a_humano':
      return {
        ok: true,
        decision: {
          tipo: 'escalar_a_humano',
          motivo: String(entrada.motivo ?? 'sin motivo'),
          // Cadena vacía = no se le manda nada al contacto. Es una opción válida.
          aviso: String(entrada.aviso ?? '').trim(),
        },
      };
    default:
      return { ok: false, motivo: `Herramienta desconocida: ${uso.name}` };
  }
}
