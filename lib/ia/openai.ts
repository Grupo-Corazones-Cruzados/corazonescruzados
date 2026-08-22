/**
 * EL PROVEEDOR DE IA DE LA APP. Uno solo, en un solo sitio.
 *
 * Desde el 2026-08-21 toda la inteligencia de la app corre sobre **OpenAI
 * `gpt-5.6-luna`**. Antes había dos claves —Anthropic para el agente de WhatsApp y OpenAI
 * para lo demás—; se unificó a petición de Fernando.
 *
 * El id del modelo vive AQUÍ y en ningún otro sitio. La lección ya estaba escrita en el
 * módulo del agente: un id repartido por el código se vuelve ingobernable en cuanto hay
 * que cambiarlo, y siempre queda uno sin migrar.
 *
 * ── LO QUE ESTE MODELO NO ACEPTA (medido contra la API el 2026-08-21, no razonado) ────
 * Estas tres son 400 secos, no parámetros que se ignoren:
 *
 *   ❌ `temperature`  → «does not support 0 with this model. Only the default (1)».
 *                       Y con 0.9 igual. NO se manda NUNCA, ni siquiera a 1.
 *   ❌ `top_p`        → «is not supported with this model».
 *   ❌ `max_tokens`   → «Use 'max_completion_tokens' instead».
 *
 * Los cuatro sitios que antes llamaban a `gpt-4o` mandaban `temperature` y `max_tokens`.
 * Cambiar solo el id del modelo los habría dejado a todos en 400.
 *
 * ── LA TRAMPA GRANDE: HERRAMIENTAS ────────────────────────────────────────────────────
 * `tools` + razonamiento **da 400 en `/v1/chat/completions`**:
 *
 *   «Function tools with reasoning_effort are not supported for gpt-5.6-luna in
 *    /v1/chat/completions. To use function tools, use /v1/responses»
 *
 * Y el razonamiento por defecto ya cuenta como `reasoning_effort`: en Chat Completions las
 * herramientas SOLO pasan con `reasoning_effort: 'none'`. Por eso **todo lo que use
 * herramientas va por `/v1/responses`** (ver `lib/agente/ia.ts`), donde funcionan con
 * cualquier nivel de esfuerzo. Aquí se resuelve solo JSON, que sí es cosa de Chat
 * Completions.
 *
 * ── EL CACHÉ ──────────────────────────────────────────────────────────────────────────
 * Es AUTOMÁTICO por prefijo: no hay `cache_control` que poner. El mínimo medido son
 * **1.024 tokens** (573 no cachea; 1.063 sí, y ahorra el 99,7 %). Cuatro veces menos
 * exigente que Haiku 4.5, que pedía 4.096.
 */

/** El modelo. Único. Si algún día cambia, cambia aquí y en ningún otro sitio. */
export const MODELO_IA = 'gpt-5.6-luna';

/**
 * Lo que se midió del modelo. Sirve para avisar en el Estudio y para no volver a
 * descubrir a golpe de 400 lo que ya está comprobado.
 */
export const CAPACIDADES_IA = {
  /** Tope de tokens de salida. */
  maxSalida: 128_000,
  /** Ventana de contexto. */
  contexto: 1_050_000,
  /** Mínimo del prefijo para que el caché entre. Medido: 573 ❌ · 1.063 ✅ */
  minimoCache: 1024,
  /** `temperature` y `top_p` dan 400. Nunca se mandan. */
  muestreo: false,
  /** Las herramientas exigen `/v1/responses`. */
  herramientasSoloEnResponses: true,
} as const;

/** Niveles de razonamiento que acepta el modelo. Todos comprobados con herramientas forzadas. */
export type EsfuerzoIA = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export function iaConfigurada(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** La clave de la app (no la del cliente del agente, que va cifrada por canal). */
export function claveIA(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error('OPENAI_API_KEY no configurada');
  return k;
}

/** Mensaje útil para el panel a partir de un fallo de la API. */
export function mensajeDeErrorIA(estado: number, cuerpo: string): string {
  if (estado === 401) return 'La clave de OpenAI no es válida (401).';
  if (estado === 403) return 'La clave de OpenAI no tiene permiso para este modelo (403).';
  if (estado === 429) return 'La clave de OpenAI llegó a su límite de uso (429).';
  if (estado === 400) return `OpenAI rechazó la petición (400): ${cuerpo.slice(0, 300)}`;
  if (estado >= 500) return `OpenAI no está disponible ahora mismo (${estado}).`;
  return `Fallo al llamar al modelo (${estado}): ${cuerpo.slice(0, 200)}`;
}

export interface PeticionJSON {
  system: string;
  user: string;
  /** Techo de salida. Va como `max_completion_tokens`: `max_tokens` da 400. */
  maxTokens: number;
  /** Por defecto se deja el del modelo. `'none'` para lo puramente mecánico. */
  esfuerzo?: EsfuerzoIA;
  /** Para el mensaje de error del log. */
  etiqueta?: string;
}

/**
 * Una respuesta en JSON del modelo. Es el patrón que ya usaba la casa —`fetch` directo a
 * `/v1/chat/completions` con `response_format: json_object`— ahora en un solo sitio.
 *
 * ⚠️ OpenAI EXIGE que la palabra «json» aparezca en los mensajes cuando se usa
 * `response_format: json_object`; si no, devuelve 400. Salió en la sonda del 2026-08-21.
 * Como los prompts los escribe cada módulo, aquí se comprueba y se añade la coletilla si
 * falta, en vez de confiar en que nadie lo olvide nunca.
 */
export async function chatJSON<T = any>(p: PeticionJSON): Promise<T> {
  const mencionaJson = /json/i.test(p.system) || /json/i.test(p.user);
  const system = mencionaJson ? p.system : `${p.system}\n\nResponde ÚNICAMENTE con un objeto JSON válido.`;

  const cuerpo: Record<string, any> = {
    model: MODELO_IA,
    response_format: { type: 'json_object' },
    // ⚠️ `max_tokens` da 400 en este modelo.
    max_completion_tokens: p.maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: p.user },
    ],
    // ⚠️ Ni `temperature` ni `top_p`: los dos dan 400. No es que se ignoren.
  };
  if (p.esfuerzo) cuerpo.reasoning_effort = p.esfuerzo;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${claveIA()}` },
    body: JSON.stringify(cuerpo),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error(`[ia${p.etiqueta ? ':' + p.etiqueta : ''}]`, res.status, err.slice(0, 300));
    throw new Error(mensajeDeErrorIA(res.status, err));
  }

  const data = await res.json();
  const contenido = data.choices?.[0]?.message?.content;
  if (!contenido) {
    // Con techo bajo el modelo no razona (medido), así que esto es raro — pero si pasa,
    // se dice por qué en vez de devolver un objeto vacío que se lea como «no hay datos».
    const fin = data.choices?.[0]?.finish_reason;
    throw new Error(`El modelo no devolvió contenido (finish_reason: ${fin ?? 'desconocido'})`);
  }
  return JSON.parse(contenido) as T;
}
