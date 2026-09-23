/**
 * Qué acepta el modelo del agente. La petición se ARMA desde esta tabla.
 *
 * ── QUÉ CAMBIÓ EL 2026-08-21 ─────────────────────────────────────────────────────────
 * Antes esto era una tabla de CUATRO modelos de Anthropic, porque cada cliente elegía el
 * suyo desde el Estudio y cada uno aceptaba parámetros distintos. Ahora la app entera
 * corre sobre **un solo modelo**, `gpt-5.6-luna` (ver `lib/ia/openai.ts`), así que la
 * tabla se queda con un solo perfil.
 *
 * Lo que NO cambió es el motivo de que este archivo exista: **un parámetro que el modelo
 * no acepta devuelve 400 y deja al agente mudo**, y eso se decide en un solo sitio, no con
 * `if`s repartidos por el código.
 *
 * ── LO QUE SE MIDIÓ CONTRA LA API (2026-08-21, no es de memoria) ─────────────────────
 *
 *   1. **Las herramientas EXIGEN `/v1/responses`.** En `/v1/chat/completions` la API
 *      responde 400: «Function tools with reasoning_effort are not supported for
 *      gpt-5.6-luna in /v1/chat/completions. To use function tools, use /v1/responses».
 *      Y el razonamiento por defecto ya cuenta: allí solo pasan con `reasoning_effort:
 *      'none'`. Como aquí la herramienta ES la decisión, el endpoint no es negociable.
 *
 *   2. **`temperature` y `top_p` dan 400**, no se ignoran. Ni siquiera `temperature: 1`
 *      se manda, por no depender de que el default no cambie.
 *
 *   3. **El caché es automático por prefijo** —no hay `cache_control` que poner— y el
 *      mínimo medido son **1.024 tokens**: con 573 devolvió `cached_tokens: 0` y con
 *      1.063 devolvió 1.054, un 99,7 % de ahorro. Sigue siendo el dato traicionero de
 *      siempre (por debajo NO cachea *y no avisa*), pero el listón es cuatro veces más
 *      bajo que el de Haiku 4.5, que pedía 4.096: conocimiento que antes NO cacheaba,
 *      ahora sí.
 *
 *   4. **Forzar la herramienta ya NO mata el razonamiento.** En Anthropic, `tool_choice`
 *      forzado + `budget_tokens` era 400 y el agente corría sin pensar. Aquí los seis
 *      niveles funcionan con `tool_choice: 'required'`, del gasto de 0 tokens de `none`
 *      a los 131 de `max`. Es una mejora real sobre lo que había.
 */

import { MODELO_IA, CAPACIDADES_IA, type EsfuerzoIA } from '@/lib/ia/openai';

/** El modelo del agente. Es el mismo de toda la app, y se define en un solo sitio. */
export const MODELO_POR_DEFECTO = MODELO_IA;

export interface Capacidades {
  /** Tope de tokens de salida del modelo. Incluye el razonamiento. */
  maxSalida: number;
  /** Ventana de contexto. */
  contexto: number;
  /** Mínimo de tokens del prefijo para que el caché entre. Por debajo NO cachea y no avisa. */
  minimoCache: number;
  /** ¿Acepta temperature/top_p? No: dan 400. */
  muestreo: boolean;
  /** ¿Las herramientas exigen el endpoint /v1/responses? Sí. */
  herramientasSoloEnResponses: boolean;
}

export const CAPACIDADES: Capacidades = {
  maxSalida: CAPACIDADES_IA.maxSalida,
  contexto: CAPACIDADES_IA.contexto,
  minimoCache: CAPACIDADES_IA.minimoCache,
  muestreo: CAPACIDADES_IA.muestreo,
  herramientasSoloEnResponses: CAPACIDADES_IA.herramientasSoloEnResponses,
};

/**
 * Con un solo modelo esto devuelve siempre lo mismo. Se conserva la firma porque el
 * Estudio y el runner la llaman con `canal.modelo`, y porque el día que haya un segundo
 * modelo el sitio donde ramificar vuelve a ser este y no diez llamadas repartidas.
 */
export function capacidadesDe(_modelo?: string): Capacidades {
  return CAPACIDADES;
}

/** El nivel de razonamiento por defecto de un canal nuevo. Coincide con el DEFAULT de la tabla. */
export const RAZONAMIENTO_POR_DEFECTO: EsfuerzoIA = 'low';

/**
 * Lo que el cliente elige en el Estudio.
 *
 * Sustituye a la antigua elección de modelo (Haiku / Sonnet / Opus): ese selector era el
 * mando de coste-vs-calidad, y con un solo modelo el equivalente es **cuánto se lo
 * piensa**. Los tres niveles salen de la medición: `none` no gasta un token en razonar,
 * `low` gasta unos 25 y `high` unos 82.
 */
export const NIVELES_OFRECIDOS = [
  { id: 'none', nombre: 'Directo', nota: 'No razona nada antes de contestar. El más rápido y barato; suficiente si el conocimiento ya responde la pregunta.' },
  { id: 'low', nombre: 'Equilibrado', nota: 'Se lo piensa un poco antes de decidir. El de por defecto.' },
  { id: 'high', nombre: 'Cuidadoso', nota: 'Razona a fondo antes de decidir. Para conocimiento complejo o reglas de negocio con muchos casos.' },
] as const;

/** Valida lo que llega del panel: un nivel inventado sería un 400 en la primera conversación. */
export function esRazonamientoValido(v: string): v is EsfuerzoIA {
  return ['none', 'low', 'medium', 'high', 'xhigh', 'max'].includes(v);
}

/**
 * ¿El bloque cacheado llega al mínimo?
 *
 * Regla práctica para estimar tokens de un texto en español: ~3,5 caracteres por token.
 * Es aproximado a propósito — sirve para AVISAR en el Estudio, no para facturar. El dato
 * de verdad es `tokens_cache_lectura` después de la primera corrida.
 */
export function cacheaElPrefijo(_modelo: string | undefined, caracteresDelPrefijo: number): {
  cachea: boolean;
  tokensEstimados: number;
  minimo: number;
  faltanCaracteres: number;
} {
  const { minimoCache } = CAPACIDADES;
  const tokensEstimados = Math.round(caracteresDelPrefijo / 3.5);
  const cachea = tokensEstimados >= minimoCache;
  return {
    cachea,
    tokensEstimados,
    minimo: minimoCache,
    faltanCaracteres: cachea ? 0 : Math.ceil((minimoCache - tokensEstimados) * 3.5),
  };
}
