/**
 * La llamada al modelo. La petición se ARMA desde la tabla de `modelos.ts`.
 *
 * Nada de `if (modelo === 'x')` repartido por el código: cada cliente elige su modelo
 * desde el Estudio, y un parámetro que un modelo no acepta **devuelve 400 y deja al
 * agente mudo**. La tabla decide qué se manda.
 */

import Anthropic from '@anthropic-ai/sdk';
import { capacidadesDe } from './modelos';
import { HERRAMIENTAS, leerDecision, type Decision } from './herramientas';

/** Bandera beta del respaldo del lado del servidor: si el modelo está saturado, Anthropic reintenta con el recomendado dentro de la misma llamada. */
const BETA_RESPALDO = 'server-side-fallback-2026-07-01';

export interface PeticionAgente {
  apiKey: string;
  modelo: string;
  maxTokens: number;
  /** Lo estable, que va primero para que lo cubra el caché. */
  perfil: string;
  conocimiento: string;
  /** Va después del punto de caché: cambia al editar los bloques pendientes. */
  reglas: string;
  /** Ventana de historial + resumen + mensaje entrante. */
  mensajes: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ResultadoAgente {
  ok: boolean;
  decision?: Decision;
  motivo?: string;
  uso: {
    modelo: string;
    tokensEntrada: number;
    tokensSalida: number;
    tokensCacheEscritura: number;
    tokensCacheLectura: number;
    duracionMs: number;
  };
}

/** ¿Se apagó el respaldo a mano, o se autodesactivó tras un rechazo de la API? */
let respaldoDesactivado = process.env.AGENTE_SIN_RESPALDO === '1';

export function armarPeticion(p: PeticionAgente): Record<string, any> {
  const cap = capacidadesDe(p.modelo);

  // El sistema, EN ORDEN. Los dos primeros bloques llevan `cache_control`: hasta ahí
  // llega el prefijo cacheado. Las reglas van detrás porque cambian más a menudo.
  const system: any[] = [];
  if (p.perfil) system.push({ type: 'text', text: p.perfil, cache_control: { type: 'ephemeral' } });
  if (p.conocimiento) system.push({ type: 'text', text: p.conocimiento, cache_control: { type: 'ephemeral' } });
  if (p.reglas) system.push({ type: 'text', text: p.reglas });

  const peticion: Record<string, any> = {
    model: p.modelo,
    // ⚠️ max_tokens acota razonamiento + respuesta JUNTOS.
    max_tokens: Math.min(p.maxTokens, cap.maxSalida),
    system,
    messages: p.mensajes,
    tools: HERRAMIENTAS,
    // El modelo ejecuta SIEMPRE exactamente una herramienta.
    tool_choice: { type: 'any' },
  };

  // ── Razonamiento ────────────────────────────────────────────────────────────
  // ⚠️ AQUÍ HAY UNA INCOMPATIBILIDAD QUE DEJA AL AGENTE MUDO AL 100 %, y no es teórica:
  // salió en el ensayo en seco del 2026-08-01, con TODAS las preguntas devolviendo 400.
  //
  // Medido contra la API (no razonado), con `tool_choice: { type: 'any' }`:
  //
  //   claude-haiku-4-5 · sin razonamiento        ✅ devuelve tool_use
  //   claude-haiku-4-5 · budget_tokens           ❌ 400 «Thinking may not be enabled
  //                                                  when tool_choice forces tool use»
  //   claude-haiku-4-5 · adaptive                ❌ 400 «adaptive thinking is not
  //                                                  supported on this model»
  //   claude-sonnet-5  · adaptive                ✅   ·  claude-sonnet-5 · sin razon. ✅
  //   claude-opus-5    · adaptive                ✅
  //
  // O sea: **el razonamiento de estilo antiguo (`budget_tokens`) es incompatible con
  // forzar el uso de herramienta; el `adaptive` no lo es.** Y como aquí la herramienta
  // ES la decisión, forzarla no es negociable — lo que se cae es el razonamiento.
  //
  // Por eso `budget_tokens` NO se manda nunca mientras `tool_choice` fuerce. La sonda
  // confirma además que Haiku sin razonamiento devuelve el `tool_use` limpio, sin
  // escribir la llamada como texto visible, que era el riesgo que motivó encenderlo.
  const fuerzaHerramienta =
    peticion.tool_choice?.type === 'any' || peticion.tool_choice?.type === 'tool';

  if (cap.thinking === 'adaptive') {
    // Se deja encendido a propósito: apagado, la familia Claude 5 puede escribir la
    // llamada a la herramienta como texto visible, que nunca se ejecuta. Fallo silencioso.
    // Convive sin problema con el forzado — comprobado arriba.
    peticion.thinking = { type: 'adaptive' };
  } else if (cap.thinking === 'budget_tokens' && !fuerzaHerramienta) {
    // Estilo antiguo. El presupuesto debe ser MENOR que max_tokens, mínimo 1024.
    const presupuesto = Math.max(1024, Math.floor(peticion.max_tokens / 2));
    if (presupuesto < peticion.max_tokens) {
      peticion.thinking = { type: 'enabled', budget_tokens: presupuesto };
    }
  }

  // `effort` va DENTRO de output_config, y en Haiku 4.5 da 400.
  if (cap.effort) peticion.output_config = { effort: 'medium' };

  // temperature/top_p/top_k: la familia Claude 5 los rechaza. Ni se mencionan si no toca.

  return peticion;
}

export async function decidir(p: PeticionAgente): Promise<ResultadoAgente> {
  const arranque = Date.now();
  const cliente = new Anthropic({ apiKey: p.apiKey });
  const peticion = armarPeticion(p);

  const vacio = { modelo: p.modelo, tokensEntrada: 0, tokensSalida: 0, tokensCacheEscritura: 0, tokensCacheLectura: 0, duracionMs: 0 };

  const llamar = async (conRespaldo: boolean) => {
    if (!conRespaldo) return cliente.messages.create(peticion as any);
    return (cliente as any).beta.messages.create({
      ...peticion,
      betas: [BETA_RESPALDO],
      fallbacks: 'default',
    });
  };

  let respuesta: any;
  try {
    respuesta = await llamar(!respaldoDesactivado);
  } catch (err: any) {
    // Si la API rechaza la bandera beta, se autodesactiva y se reintenta sin ella: un
    // cambio de contrato no puede dejar al agente mudo.
    const mensaje = String(err?.message ?? '');
    const esBandera = !respaldoDesactivado && /beta|fallback|unsupported|unknown/i.test(mensaje);
    if (!esBandera) {
      return { ok: false, motivo: mensajeDeError(err), uso: { ...vacio, duracionMs: Date.now() - arranque } };
    }
    respaldoDesactivado = true;
    console.warn('[agente] respaldo del servidor desactivado:', mensaje);
    try {
      respuesta = await llamar(false);
    } catch (err2: any) {
      return { ok: false, motivo: mensajeDeError(err2), uso: { ...vacio, duracionMs: Date.now() - arranque } };
    }
  }

  const u = respuesta?.usage ?? {};
  const uso = {
    modelo: respuesta?.model ?? p.modelo,
    tokensEntrada: u.input_tokens ?? 0,
    tokensSalida: u.output_tokens ?? 0,
    tokensCacheEscritura: u.cache_creation_input_tokens ?? 0,
    // ⇐ El dato que dice si el caché de verdad entró. Cero en corridas repetidas
    //   significa que el prefijo no llega al mínimo del modelo, o que algo lo cambia.
    tokensCacheLectura: u.cache_read_input_tokens ?? 0,
    duracionMs: Date.now() - arranque,
  };

  const leida = leerDecision(respuesta);
  return leida.ok ? { ok: true, decision: leida.decision, uso } : { ok: false, motivo: leida.motivo, uso };
}

/** Mensaje útil para el panel. La clave de IA la pone el cliente: si falla, tiene que saber por qué. */
function mensajeDeError(err: any): string {
  const estado = err?.status;
  if (estado === 401) return 'La clave de IA del cliente no es válida (401). Hay que actualizarla en el Estudio.';
  if (estado === 403) return 'La clave de IA no tiene permiso para este modelo (403).';
  if (estado === 429) return 'La clave de IA del cliente llegó a su límite de uso (429).';
  if (estado === 400) return `La API rechazó la petición (400): ${err?.message ?? ''}`.trim();
  if (estado >= 500) return `Anthropic no está disponible ahora mismo (${estado}).`;
  return err?.message ? `Fallo al llamar al modelo: ${err.message}` : 'Fallo al llamar al modelo';
}
