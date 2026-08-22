/**
 * La llamada al modelo. La petición se ARMA desde la tabla de `modelos.ts`.
 *
 * Sustituye a `anthropic.ts` desde el 2026-08-21: la app entera pasó a **OpenAI
 * `gpt-5.6-luna`** (ver `lib/ia/openai.ts`). La forma del módulo no cambia —`decidir()`
 * entra y sale igual, y el runner no se enteró—, pero por dentro cambia TODO el contrato.
 *
 * ── POR QUÉ `/v1/responses` Y NO `/v1/chat/completions` ──────────────────────────────
 * No es una preferencia: es el único endpoint donde este modelo acepta herramientas.
 * Medido contra la API el 2026-08-21:
 *
 *   chat/completions · tools, sin razonamiento explícito  ❌ 400 «Function tools with
 *       reasoning_effort are not supported for gpt-5.6-luna in /v1/chat/completions.
 *       To use function tools, use /v1/responses»
 *   chat/completions · tools + reasoning_effort 'none'    ✅ (pero sin poder razonar)
 *   responses        · tools + effort none|low|medium|high|xhigh|max   ✅ los seis
 *
 * Y aquí la herramienta ES la decisión, así que forzarla no es negociable.
 *
 * ── LA BUENA NOTICIA FRENTE A ANTHROPIC ──────────────────────────────────────────────
 * El agente corría **sin razonar**. En Anthropic, `tool_choice` forzado era incompatible
 * con `budget_tokens` (400: «Thinking may not be enabled when tool_choice forces tool
 * use»), y Haiku 4.5 no admitía `adaptive`, así que el modelo por defecto decidía a
 * pelo. Aquí forzar la herramienta convive con los seis niveles de razonamiento. El
 * cliente elige el suyo en el Estudio.
 *
 * ── EL CACHÉ YA NO SE PIDE ───────────────────────────────────────────────────────────
 * No hay `cache_control` ni bloques `ephemeral`: OpenAI cachea el prefijo solo. Lo que sí
 * importa es **el orden** —lo estable delante, lo que cambia detrás— porque el caché es
 * un prefijo literal: una coma antes del conocimiento invalida todo lo que viene después.
 * Por eso el sistema se monta como una sola cadena en orden fijo.
 *
 * `prompt_cache_key` agrupa las peticiones del mismo canal para que caigan en la misma
 * máquina y el prefijo se reencuentre.
 */

import OpenAI from 'openai';
import { capacidadesDe, RAZONAMIENTO_POR_DEFECTO } from './modelos';
import { MODELO_IA, type EsfuerzoIA } from '@/lib/ia/openai';
import { HERRAMIENTAS, leerDecision, type Decision } from './herramientas';

export interface PeticionAgente {
  apiKey: string;
  modelo: string;
  maxTokens: number;
  /** Lo estable, que va primero para que lo cubra el caché. */
  perfil: string;
  conocimiento: string;
  /** Va al final del sistema: cambia al editar los bloques pendientes. */
  reglas: string;
  /** Ventana de historial + resumen + mensaje entrante. */
  mensajes: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Cuánto se lo piensa antes de decidir. Lo elige el cliente en el Estudio. */
  esfuerzo?: EsfuerzoIA;
  /** Agrupa las peticiones del canal para que el caché se reencuentre. */
  claveCache?: string;
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

/**
 * El sistema, EN ORDEN Y COMO UNA SOLA CADENA.
 *
 * Perfil y conocimiento primero (lo estable, lo que se cachea); las reglas al final
 * porque cambian más a menudo y todo lo que va detrás de un cambio deja de cachear.
 */
export function armarSistema(p: Pick<PeticionAgente, 'perfil' | 'conocimiento' | 'reglas'>): string {
  return [p.perfil, p.conocimiento, p.reglas].filter(Boolean).join('\n\n');
}

export function armarPeticion(p: PeticionAgente): Record<string, any> {
  const cap = capacidadesDe(p.modelo);

  const peticion: Record<string, any> = {
    model: p.modelo || MODELO_IA,
    instructions: armarSistema(p),
    input: p.mensajes,
    tools: HERRAMIENTAS,
    // El modelo ejecuta SIEMPRE exactamente una herramienta.
    tool_choice: 'required',
    // ⚠️ `max_output_tokens` acota razonamiento + respuesta JUNTOS, igual que el viejo
    // `max_tokens` de Anthropic. Y `max_tokens` a secas aquí es un 400.
    max_output_tokens: Math.min(p.maxTokens, cap.maxSalida),
    // Una sola decisión por corrida: nada de dos herramientas a la vez.
    parallel_tool_calls: false,
    // La conversación la guardamos nosotros en Postgres. Que OpenAI no retenga nada del
    // WhatsApp de una persona no es una optimización: es la promesa del aviso legal.
    store: false,
    reasoning: { effort: p.esfuerzo ?? RAZONAMIENTO_POR_DEFECTO },
  };

  if (p.claveCache) peticion.prompt_cache_key = p.claveCache;

  // ⚠️ NI `temperature` NI `top_p`. No es que este modelo los ignore: devuelve 400
  // («Unsupported parameter: 'top_p' is not supported with this model»; con temperature,
  // «Only the default (1) value is supported»). Ni siquiera se manda el valor por defecto.

  return peticion;
}

export async function decidir(p: PeticionAgente): Promise<ResultadoAgente> {
  const arranque = Date.now();
  const cliente = new OpenAI({ apiKey: p.apiKey });
  const peticion = armarPeticion(p);

  const vacio = { modelo: p.modelo, tokensEntrada: 0, tokensSalida: 0, tokensCacheEscritura: 0, tokensCacheLectura: 0, duracionMs: 0 };

  let respuesta: any;
  try {
    respuesta = await cliente.responses.create(peticion as any);
  } catch (err: any) {
    return { ok: false, motivo: mensajeDeError(err), uso: { ...vacio, duracionMs: Date.now() - arranque } };
  }

  const u = respuesta?.usage ?? {};
  const uso = {
    modelo: respuesta?.model ?? p.modelo,
    tokensEntrada: u.input_tokens ?? 0,
    tokensSalida: u.output_tokens ?? 0,
    // ⚠️ Los dos contadores del caché ya no son campos de primer nivel: cuelgan de
    // `input_tokens_details`. Si se leyeran con los nombres de Anthropic saldría 0 en
    // todo, y el panel diría que el caché nunca entra — que es justo el dato que sirve
    // para saber si el conocimiento llega al mínimo.
    tokensCacheEscritura: u.input_tokens_details?.cache_write_tokens ?? 0,
    tokensCacheLectura: u.input_tokens_details?.cached_tokens ?? 0,
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
  if (estado >= 500) return `OpenAI no está disponible ahora mismo (${estado}).`;
  return err?.message ? `Fallo al llamar al modelo: ${err.message}` : 'Fallo al llamar al modelo';
}
