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
 * Se llaman con `tool_choice: 'required'` por **`/v1/responses`**, no por
 * `/v1/chat/completions`: ahí las herramientas dan 400 salvo con el razonamiento apagado
 * («To use function tools, use /v1/responses»). Medido el 2026-08-21.
 *
 * `strict: true` va **en la definición de la herramienta**, no en `tool_choice`, y exige
 * `additionalProperties: false` + `required`. Con eso el esquema se valida de verdad y el
 * modelo no puede inventarse un campo.
 *
 * ⚠️ El formato es el de la API de Responses, que NO es el de Chat Completions ni el de
 * Anthropic: aquí `name`/`parameters` van al RAÍZ del objeto (en Chat Completions van
 * anidados bajo `function`, y en Anthropic el esquema se llamaba `input_schema`).
 *
 * Módulo puro: sin red ni base de datos.
 */

export type NombreHerramienta = 'responder' | 'no_responder' | 'escalar_a_humano';

export interface Herramienta {
  type: 'function';
  name: NombreHerramienta;
  description: string;
  strict: true;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
    additionalProperties: false;
  };
}

export const HERRAMIENTAS: Herramienta[] = [
  {
    type: 'function',
    name: 'responder',
    description:
      'Envía una respuesta al contacto por WhatsApp. Úsala cuando puedas contestar con el conocimiento disponible.',
    strict: true,
    parameters: {
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
    type: 'function',
    name: 'no_responder',
    description:
      'No contesta nada. Úsala solo con publicidad, cadenas, estafas, contenido ofensivo o mensajes sin ninguna intención.',
    strict: true,
    parameters: {
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
    type: 'function',
    name: 'escalar_a_humano',
    description:
      'Pasa la conversación a una persona del equipo y apaga el bot en este chat. Úsala si falta el dato, si hay un reclamo, o si el contacto pide hablar con alguien.',
    strict: true,
    parameters: {
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
 * Lee la decisión de la respuesta del modelo (formato de `/v1/responses`).
 *
 * ⚠️ La respuesta NO es `content[]` como en Anthropic: es **`output[]`**, una lista de
 * items donde la llamada a la herramienta es `{ type: 'function_call', name, arguments }`
 * y los `arguments` vienen como **cadena JSON**, no como objeto. Un `JSON.parse` que
 * falle aquí dejaría la conversación en silencio, así que se captura.
 *
 * ⚠️ Hay que mirar la NEGATIVA antes que nada: en Responses no llega como un
 * `stop_reason`, sino como un item de mensaje con `content[].type === 'refusal'`. Si se
 * buscara primero el `function_call` se reportaría «no eligió herramienta», que es un
 * diagnóstico falso.
 *
 * ⚠️ Y sigue en pie el fallo silencioso que motivó esta función: el modelo puede escribir
 * la llamada como **texto visible** en vez de ejecutarla. Nunca se ejecuta y no hay error.
 * Aquí eso se detecta —no hay item `function_call`— y se devuelve un fallo explícito.
 */
export function leerDecision(respuesta: any):
  | { ok: true; decision: Decision }
  | { ok: false; motivo: string } {
  if (!respuesta) return { ok: false, motivo: 'La API no devolvió respuesta' };

  const salida: any[] = Array.isArray(respuesta.output) ? respuesta.output : [];

  // La negativa, primero.
  for (const item of salida) {
    const partes: any[] = Array.isArray(item?.content) ? item.content : [];
    const negativa = partes.find((c) => c?.type === 'refusal');
    if (negativa) {
      return { ok: false, motivo: `El modelo rechazó la petición: ${negativa.refusal ?? 'sin motivo'}` };
    }
  }

  const uso = salida.find((o) => o?.type === 'function_call');

  if (!uso) {
    // `incomplete` con `max_output_tokens` es el equivalente al viejo `stop_reason`.
    if (respuesta.status === 'incomplete') {
      const razon = respuesta.incomplete_details?.reason ?? 'desconocida';
      return { ok: false, motivo: `La respuesta se cortó antes de decidir (${razon})` };
    }
    // El fallo silencioso descrito arriba: texto en vez de llamada.
    const texto = salida
      .flatMap((o) => (Array.isArray(o?.content) ? o.content : []))
      .find((c: any) => c?.type === 'output_text')?.text?.slice(0, 200);
    return {
      ok: false,
      motivo: texto
        ? `El modelo escribió texto en vez de usar una herramienta: "${texto}"`
        : 'El modelo no eligió ninguna herramienta',
    };
  }

  // Los argumentos llegan como cadena. Que no parseen es un fallo del modelo, no nuestro,
  // pero tiene que salir como motivo legible y no como una excepción sin contexto.
  let entrada: any;
  try {
    entrada = typeof uso.arguments === 'string' ? JSON.parse(uso.arguments || '{}') : (uso.arguments ?? {});
  } catch {
    return { ok: false, motivo: `Los argumentos de ${uso.name} no son JSON válido` };
  }

  switch (uso.name) {
    case 'responder': {
      const texto = limpiarTexto(String(entrada.texto ?? ''));
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
          aviso: limpiarTexto(String(entrada.aviso ?? '')),
        },
      };
    default:
      return { ok: false, motivo: `Herramienta desconocida: ${uso.name}` };
  }
}

/**
 * Limpia el texto que el modelo va a mandarle a una persona por WhatsApp.
 *
 * ⚠️ NO es paranoia: salió en el ensayo en seco del agente de GCC (2026-08-01). A la
 * pregunta «¿ya me aceptaron?» el modelo contestó
 *
 *     «Un compañero revisará su postulación en seguida.</aniso>»
 *
 * — con una etiqueta de cierre inventada pegada al final. Eso habría salido tal cual al
 * WhatsApp de una persona real. Ocurre de vez en cuando y no hay forma de impedirlo desde
 * el prompt: la única defensa fiable está aquí, en la salida.
 *
 * Se quitan SOLO etiquetas bien formadas (`<algo>`, `</algo>`, `<algo/>`). Un `<` suelto
 * se respeta a propósito, porque «el precio es < 10» es texto legítimo y romperlo sería
 * peor que la etiqueta que se intenta limpiar.
 */
export function limpiarTexto(texto: string): string {
  return texto
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*\s*\/?>/g, '')
    // Un cierre de etiqueta suele dejar dobles espacios o espacio antes de un punto.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
