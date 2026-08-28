/**
 * LO QUE CUESTA CADA CONVERSACIÓN, en dólares.
 *
 * ── POR QUÉ ESTO ES UN ARCHIVO Y NO TRES NÚMEROS EN UNA PANTALLA ──────────────────────
 * Estas cifras acaban delante de un cliente, y un cliente que ve «$0,04» decide cosas con
 * ese número. Un precio copiado en dos sitios es un precio que dentro de un mes dice dos
 * cosas distintas, y nadie revisa el que no está mirando. Así que viven aquí, con la fecha
 * en que se comprobaron y de dónde salieron, y quien los necesite los pide.
 *
 * ── LOS PRECIOS (consultados el 2026-08-28) ───────────────────────────────────────────
 * `gpt-5.6-luna`, tarifa estándar de la API de OpenAI, por millón de tokens:
 *
 *   · entrada ................ 0,20 $
 *   · entrada desde caché .... 0,02 $   (el 10 % de la entrada normal)
 *   · salida ................. 1,20 $
 *
 * ⚠️ **No se contempla la tarifa de contexto largo** (0,40 $ / 1,80 $), que entra en
 * peticiones mucho mayores. El agente ronda los 8.000 tokens por llamada — dos órdenes de
 * magnitud por debajo—, así que aplicarla sería inflar la factura que ve el cliente. Si
 * algún día un agente creciera hasta ahí, esto se queda corto y hay que ampliarlo.
 */

/** Dólares por millón de tokens. Un solo modelo en toda la app: ver `lib/ia/openai.ts`. */
export const PRECIOS_POR_MILLON = {
  entrada: 0.20,
  entradaCacheada: 0.02,
  salida: 1.20,
} as const;

/** Cuándo se comprobaron estos precios. Si esto envejece, la cifra de la pantalla miente. */
export const PRECIOS_COMPROBADOS_EN = '2026-08-28';

export interface UsoDeTokens {
  tokensEntrada: number;
  tokensSalida: number;
  /** Los que vinieron del caché. **Van DENTRO de `tokensEntrada`**, no aparte. */
  tokensCacheLectura: number;
}

/**
 * El coste en dólares de un consumo.
 *
 * ⚠️ **`input_tokens` de OpenAI YA INCLUYE los cacheados**; `cached_tokens` es un
 * subconjunto suyo, no un contador aparte. Sumarlos por separado cobraría dos veces los
 * mismos tokens —y encima al precio caro— inflando la cifra justo en las conversaciones
 * largas, que son las que más caché aprovechan. Por eso lo primero que se hace es restar.
 */
export function costoEnDolares(uso: UsoDeTokens): number {
  const cacheados = Math.min(Math.max(uso.tokensCacheLectura, 0), Math.max(uso.tokensEntrada, 0));
  const frescos = Math.max(uso.tokensEntrada, 0) - cacheados;

  return (
    (frescos / 1_000_000) * PRECIOS_POR_MILLON.entrada +
    (cacheados / 1_000_000) * PRECIOS_POR_MILLON.entradaCacheada +
    (Math.max(uso.tokensSalida, 0) / 1_000_000) * PRECIOS_POR_MILLON.salida
  );
}

/**
 * El coste, escrito para que lo lea una persona.
 *
 * Una conversación entera cuesta céntimos, así que con dos decimales casi todo sale
 * «$0,00» — que se lee como «esto es gratis» y no como «esto es muy barato». Son cosas
 * distintas y la segunda es la verdad. Por eso, por debajo de un centavo se dan cuatro
 * decimales; a partir de ahí, los dos de siempre.
 *
 * Formato español, como el resto de la app (ver `lib/format.ts`): coma decimal.
 */
export function costoLegible(dolares: number): string {
  if (dolares <= 0) return '$0,00';
  const decimales = dolares < 0.01 ? 4 : 2;
  return `$${dolares.toLocaleString('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`;
}
