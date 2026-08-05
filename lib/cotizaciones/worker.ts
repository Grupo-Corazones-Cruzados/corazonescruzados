import { normalizeQuotePayload, type QuotePayload } from '@/lib/cotizaciones/schema';

/**
 * Cliente HTTP del WORKER DEDICADO de cotizaciones (Agent SDK corriendo sobre Kimi K2.6).
 *
 * La app web NO ejecuta el agente: habla con un servicio worker long-running (patrón del
 * worker de Percepción) que mantiene la sesión viva del Agent SDK y la reanuda por
 * `sessionId`. Autenticación por token compartido (`x-worker-token`), fail-closed.
 *
 * ⚠️ El modelo que se manda aquí se GUARDA en `quote_sessions`, así que este default y el del
 * worker tienen que decir lo mismo o el historial miente sobre con qué se generó cada
 * cotización. La clave del proveedor vive SOLO en el worker (`KIMI_API_KEY`), no aquí.
 *
 * Config (env, en la app y en el worker):
 *   COTIZADOR_WORKER_URL    — base URL del worker (p. ej. https://cotizador.up.railway.app)
 *   COTIZADOR_WORKER_TOKEN  — secreto compartido
 *   COTIZADOR_MODEL         — opcional, default 'kimi-k2.6'
 */
const WORKER_URL = process.env.COTIZADOR_WORKER_URL || '';
const WORKER_TOKEN = process.env.COTIZADOR_WORKER_TOKEN || '';
export const COTIZADOR_MODEL = process.env.COTIZADOR_MODEL || 'kimi-k2.6';
const TIMEOUT_MS = 280_000; // el agente puede tardar; el worker responde cuando termina

export function cotizadorConfigured(): boolean {
  return Boolean(WORKER_URL && WORKER_TOKEN);
}

export type QuoteAgentContext = {
  /** Miembro dueño (para que la tool "mis proyectos" del agente se limite a sus proyectos). */
  memberId: number | null;
  userId: string;
  service: { id: number | null; name: string; rate: number | null };
  detail: string;
  instructions: string;
  /**
   * La cotización tal como está GUARDADA, para el chat.
   *
   * Va en cada turno a propósito, aunque se reanude la sesión: la base es la fuente de verdad
   * y la memoria del modelo no. Sin esto, una sesión perdida (contenedor nuevo) hacía que el
   * agente se inventara la cotización, y una edición hecha fuera del chat lo dejaba trabajando
   * sobre una versión vieja.
   */
  currentQuote?: unknown;
};

async function callWorker(path: string, body: any): Promise<any> {
  if (!cotizadorConfigured()) {
    throw new Error('El worker de cotizaciones no está configurado (falta COTIZADOR_WORKER_URL / COTIZADOR_WORKER_TOKEN).');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${WORKER_URL.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-token': WORKER_TOKEN },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Respuesta no-JSON del worker (${res.status}): ${text.slice(0, 200)}`); }
    if (!res.ok) throw new Error(data?.error || `Worker respondió ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Genera la PRIMERA cotización. El worker crea una sesión nueva del Agent SDK, la mantiene
 * viva y devuelve su `sessionId` (para reanudar el chat luego) + el payload estructurado.
 */
export async function generateQuote(ctx: QuoteAgentContext & { model?: string }): Promise<{ sessionId: string; payload: QuotePayload; reply?: string }> {
  const data = await callWorker('/generate', {
    model: ctx.model || COTIZADOR_MODEL,
    context: {
      memberId: ctx.memberId, userId: ctx.userId,
      service: ctx.service, detail: ctx.detail, instructions: ctx.instructions,
    },
  });
  return { sessionId: String(data.sessionId || ''), payload: normalizeQuotePayload(data.payload), reply: data.reply ? String(data.reply) : undefined };
}

/**
 * Continúa la conversación (chat "GCC Bot") sobre una cotización existente. Reanuda la
 * sesión por `sessionId`. Si el agente reformula la cotización, devuelve un `payload` nuevo
 * (que la app versiona y materializa); si solo responde una consulta, `payload` viene vacío.
 */
export async function chatQuote(opts: {
  sessionId: string; message: string; model?: string; context: QuoteAgentContext;
}): Promise<{ sessionId: string; reply: string; payload: QuotePayload | null; sesionNueva: boolean }> {
  const data = await callWorker('/chat', {
    sessionId: opts.sessionId,
    model: opts.model || COTIZADOR_MODEL,
    message: opts.message,
    context: {
      memberId: opts.context.memberId, userId: opts.context.userId,
      service: opts.context.service, detail: opts.context.detail, instructions: opts.context.instructions,
      currentQuote: opts.context.currentQuote ?? null,
    },
  });
  return {
    sessionId: String(data.sessionId || opts.sessionId),
    reply: String(data.reply || ''),
    payload: data.payload ? normalizeQuotePayload(data.payload) : null,
    // El worker no pudo reanudar y empezó de cero: el trabajo se conserva (venía en el
    // contexto), pero el hilo de la conversación anterior se perdió.
    sesionNueva: Boolean(data.sesionNueva),
  };
}
