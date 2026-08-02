/**
 * Qué acepta cada modelo. La petición a Anthropic se ARMA desde esta tabla.
 *
 * Por qué existe: no todos los modelos aceptan los mismos parámetros, y mandar uno de
 * más devuelve un 400 seco. Con un modelo configurable por cliente —cada uno elige el
 * suyo desde el Estudio— un `if (modelo === '...')` repartido por el código se vuelve
 * ingobernable. Aquí está en un solo sitio.
 *
 * Los valores no son de memoria: salen de la referencia oficial de la API de Anthropic.
 * Las tres trampas que ya se pagaron en el proyecto anterior están todas aquí:
 *
 *   1. `output_config.effort` **da 400 en Haiku 4.5**. No es que se ignore: falla.
 *   2. `temperature`, `top_p` y `top_k` los **rechaza toda la familia Claude 5**.
 *   3. El **mínimo de caché depende del modelo**, y por debajo NO cachea *y no avisa*.
 *      Es el más traicionero: todo funciona, solo que pagando el prompt entero cada vez.
 *      Se comprueba mirando `tokens_cache_lectura` en `agente_uso_modelo`.
 *
 * ⚠️ El mínimo de caché **no crece con la generación**: son 512 en Opus 5 pero 4.096 en
 * Haiku 4.5. Un conocimiento de 3.000 tokens cachea en Opus 5 y NO cachea en Haiku.
 */

export type FormaThinking = 'adaptive' | 'budget_tokens' | 'ninguno';

export interface Capacidades {
  /** Cómo se pide el razonamiento en este modelo. */
  thinking: FormaThinking;
  /** ¿Acepta `output_config.effort`? En Haiku 4.5 da 400. */
  effort: boolean;
  /** ¿Acepta temperature/top_p/top_k? La familia Claude 5 los rechaza. */
  muestreo: boolean;
  /** Mínimo de tokens del prefijo para que el caché entre. Por debajo NO cachea y no avisa. */
  minimoCache: number;
  /** Tope de tokens de salida del modelo. */
  maxSalida: number;
  /** Ventana de contexto. */
  contexto: number;
}

/**
 * Perfil CONSERVADOR para un modelo que no conocemos.
 *
 * Ante un modelo nuevo, no mandar nada opcional: un parámetro de más es un 400 y el
 * agente se queda mudo. Un parámetro de menos solo es una respuesta algo peor.
 * El mínimo de caché se pone en el más alto conocido para no dar por hecho un ahorro
 * que igual no existe.
 */
export const PERFIL_DESCONOCIDO: Capacidades = {
  thinking: 'ninguno',
  effort: false,
  muestreo: false,
  minimoCache: 4096,
  maxSalida: 8192,
  contexto: 200_000,
};

export const CAPACIDADES: Record<string, Capacidades> = {
  // El de por defecto (decisión del cliente por costo). Ojo: es el que MÁS exige al
  // caché — 4.096 tokens — y el único que NO acepta `effort`.
  'claude-haiku-4-5': {
    // El estilo antiguo; `adaptive` da 400 aquí («not supported on this model»).
    // ⚠️ Y `budget_tokens` es INCOMPATIBLE con forzar herramienta, que es lo que hace el
    // agente siempre — así que en la práctica este modelo corre SIN razonamiento. Lo
    // resuelve `armarPeticion()`, donde está medida la matriz entera.
    thinking: 'budget_tokens',
    effort: false,             // ⚠️ mandarlo = 400
    muestreo: true,
    minimoCache: 4096,
    maxSalida: 64_000,
    contexto: 200_000,
  },
  'claude-sonnet-5': {
    thinking: 'adaptive',
    effort: true,
    muestreo: false,           // ⚠️ mandarlo = 400
    minimoCache: 1024,
    maxSalida: 128_000,
    contexto: 1_000_000,
  },
  'claude-opus-5': {
    thinking: 'adaptive',      // va encendido por defecto en este modelo
    effort: true,
    muestreo: false,
    minimoCache: 512,          // el más bajo: cachea prompts que en Haiku no cachearían
    maxSalida: 128_000,
    contexto: 1_000_000,
  },
  'claude-opus-4-8': {
    thinking: 'adaptive',      // aquí hay que pedirlo explícitamente
    effort: true,
    muestreo: false,
    minimoCache: 1024,
    maxSalida: 128_000,
    contexto: 1_000_000,
  },
};

export const MODELO_POR_DEFECTO = 'claude-haiku-4-5';

/** Los modelos que se ofrecen en el Estudio, del más barato al más capaz. */
export const MODELOS_OFRECIDOS = [
  { id: 'claude-haiku-4-5', nombre: 'Haiku 4.5', nota: 'El más rápido y económico. El de por defecto.' },
  { id: 'claude-sonnet-5', nombre: 'Sonnet 5', nota: 'Equilibrio entre calidad y costo.' },
  { id: 'claude-opus-5', nombre: 'Opus 5', nota: 'El más capaz. Para conocimiento complejo.' },
] as const;

export function capacidadesDe(modelo: string): Capacidades {
  return CAPACIDADES[modelo] ?? PERFIL_DESCONOCIDO;
}

/**
 * ¿El bloque cacheado llega al mínimo del modelo?
 *
 * Regla práctica para estimar tokens de un texto en español: ~3,5 caracteres por token.
 * Es aproximado a propósito — sirve para AVISAR en el Estudio, no para facturar. El dato
 * de verdad es `tokens_cache_lectura` después de la primera corrida.
 */
export function cacheaElPrefijo(modelo: string, caracteresDelPrefijo: number): {
  cachea: boolean;
  tokensEstimados: number;
  minimo: number;
  faltanCaracteres: number;
} {
  const { minimoCache } = capacidadesDe(modelo);
  const tokensEstimados = Math.round(caracteresDelPrefijo / 3.5);
  const cachea = tokensEstimados >= minimoCache;
  return {
    cachea,
    tokensEstimados,
    minimo: minimoCache,
    faltanCaracteres: cachea ? 0 : Math.ceil((minimoCache - tokensEstimados) * 3.5),
  };
}
