/**
 * EL PROVEEDOR DE IA DEL PRODUCTO. Uno solo (OpenAI, decisión de Fernando del
 * 2026-08-21 para toda la casa), en un solo sitio. Tres capacidades distintas:
 *
 *  - El AGENTE que redacta la semana: `gpt-5.6-luna` por `/v1/responses`, con la
 *    búsqueda web integrada de OpenAI (`web_search`) y una herramienta de función
 *    para consultar los adjuntos. Salida en JSON con esquema estricto.
 *  - La TRANSCRIPCIÓN del micrófono: `gpt-4o-mini-transcribe`.
 *  - Los EMBEDDINGS de los adjuntos: `text-embedding-3-small` (1536).
 *
 * ── LO MEDIDO CONTRA LA API (2026-09-15, no razonado) ──────────────────────────
 *  · `web_search` (integrada) + herramienta de función + `text.format` json_schema
 *    conviven en UNA llamada. El modelo busca en YouTube y devuelve enlaces reales.
 *  · Con `store: false`, el bucle de herramientas funciona devolviendo TODOS los
 *    ítems de salida (incluido el `reasoning`) en el `input` siguiente, siempre que
 *    se pida `include: ['reasoning.encrypted_content']`.
 *  · `temperature`, `top_p` y `max_tokens` son 400 secos con este modelo (memoria
 *    de la casa): no se mandan.
 */

export const MODELO_AGENTE = 'gpt-5.6-luna';
export const MODELO_TRANSCRIPCION = 'gpt-4o-mini-transcribe';
export const MODELO_EMBEDDINGS = 'text-embedding-3-small';
export const DIMENSIONES_EMBEDDING = 1536;

export const iaConfigurada = () => Boolean(process.env.OPENAI_API_KEY);

function clave() {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error('Falta OPENAI_API_KEY: el agente no puede redactar.');
  return k;
}

export function mensajeDeErrorIA(estado: number, cuerpo: string): string {
  if (estado === 401) return 'La clave de OpenAI no es válida (401).';
  if (estado === 403) return 'La clave de OpenAI no tiene permiso para este modelo (403).';
  if (estado === 429) return 'La clave de OpenAI llegó a su límite de uso (429). Inténtalo en unos minutos.';
  if (estado === 400) return `OpenAI rechazó la petición (400): ${cuerpo.slice(0, 300)}`;
  if (estado >= 500) return `OpenAI no está disponible ahora mismo (${estado}).`;
  return `Fallo al llamar al modelo (${estado}): ${cuerpo.slice(0, 200)}`;
}

// ── El agente ───────────────────────────────────────────────────────────────

export type HerramientaFuncion = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  ejecutar: (args: Record<string, unknown>) => Promise<string>;
};

export type UsoIA = {
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  tokensCache: number;
  busquedasWeb: number;
  llamadasHerramientas: number;
  vueltas: number;
  duracionMs: number;
};

export type ResultadoAgente<T> = { ok: true; salida: T; uso: UsoIA } | { ok: false; error: string; uso: UsoIA };

/**
 * Una corrida del agente: sistema + encargo → JSON con el esquema pedido, con
 * las herramientas que haga falta por el camino. Como mucho `maxVueltas` idas y
 * vueltas de herramientas de función (la búsqueda web la resuelve OpenAI dentro
 * de la misma llamada).
 */
export async function correrAgente<T>(p: {
  sistema: string;
  encargo: string;
  esquema: { nombre: string; schema: Record<string, unknown> };
  herramientas?: HerramientaFuncion[];
  busquedaWeb?: boolean;
  esfuerzo?: 'low' | 'medium' | 'high';
  maxSalida?: number;
  maxVueltas?: number;
  claveCache?: string;
}): Promise<ResultadoAgente<T>> {
  const arranque = Date.now();
  const uso: UsoIA = {
    modelo: MODELO_AGENTE,
    tokensEntrada: 0,
    tokensSalida: 0,
    tokensCache: 0,
    busquedasWeb: 0,
    llamadasHerramientas: 0,
    vueltas: 0,
    duracionMs: 0,
  };
  const funciones = p.herramientas ?? [];
  const tools: Record<string, unknown>[] = [];
  if (p.busquedaWeb) tools.push({ type: 'web_search' });
  for (const h of funciones)
    tools.push({ type: 'function', name: h.name, description: h.description, strict: true, parameters: h.parameters });

  const base: Record<string, unknown> = {
    model: MODELO_AGENTE,
    // Lo estable delante (sistema) y lo que cambia detrás (encargo): el caché de
    // OpenAI es un prefijo literal.
    instructions: p.sistema,
    tools: tools.length ? tools : undefined,
    text: { format: { type: 'json_schema', name: p.esquema.nombre, strict: true, schema: p.esquema.schema } },
    max_output_tokens: p.maxSalida ?? 16_000,
    reasoning: { effort: p.esfuerzo ?? 'medium' },
    store: false,
    include: ['reasoning.encrypted_content'],
    // ⚠️ Ni `temperature` ni `top_p`: son 400 con este modelo.
  };
  if (p.claveCache) base.prompt_cache_key = p.claveCache;

  let input: unknown[] = [{ role: 'user', content: p.encargo }];
  const maxVueltas = p.maxVueltas ?? 6;

  for (let vuelta = 1; vuelta <= maxVueltas; vuelta++) {
    uso.vueltas = vuelta;
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave()}` },
      body: JSON.stringify({ ...base, input }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[agente]', res.status, t.slice(0, 400));
      uso.duracionMs = Date.now() - arranque;
      return { ok: false, error: mensajeDeErrorIA(res.status, t), uso };
    }
    const data = await res.json();
    const u = data.usage ?? {};
    uso.tokensEntrada += u.input_tokens ?? 0;
    uso.tokensSalida += u.output_tokens ?? 0;
    uso.tokensCache += u.input_tokens_details?.cached_tokens ?? 0;
    const salida: any[] = data.output ?? [];
    uso.busquedasWeb += salida.filter((o) => o.type === 'web_search_call').length;

    const llamadas = salida.filter((o) => o.type === 'function_call');
    if (!llamadas.length) {
      const texto =
        data.output_text ??
        salida
          .filter((o) => o.type === 'message')
          .map((o) => (o.content ?? []).map((c: any) => c.text ?? '').join(''))
          .join('');
      uso.duracionMs = Date.now() - arranque;
      if (!texto) {
        const motivo = data.incomplete_details?.reason ?? data.status ?? 'sin contenido';
        return { ok: false, error: `El modelo no devolvió la planificación (${motivo}).`, uso };
      }
      try {
        return { ok: true, salida: JSON.parse(texto) as T, uso };
      } catch {
        return { ok: false, error: 'El modelo devolvió un JSON que no se pudo leer.', uso };
      }
    }

    // Ejecutar las herramientas y devolver TODO lo que salió (incluido el
    // razonamiento cifrado), que es lo que exige `store: false`.
    const respuestas = [];
    for (const c of llamadas) {
      uso.llamadasHerramientas++;
      const h = funciones.find((f) => f.name === c.name);
      let resultado = 'Herramienta desconocida.';
      if (h) {
        try {
          resultado = await h.ejecutar(JSON.parse(c.arguments || '{}'));
        } catch (e: any) {
          resultado = `La herramienta falló: ${e?.message ?? e}`;
        }
      }
      respuestas.push({ type: 'function_call_output', call_id: c.call_id, output: resultado });
    }
    input = [...input, ...salida, ...respuestas];
  }

  uso.duracionMs = Date.now() - arranque;
  return { ok: false, error: 'El agente no terminó en el número de vueltas permitido.', uso };
}

// ── Transcripción ───────────────────────────────────────────────────────────

/** Audio del micrófono → texto en español. */
export async function transcribir(audio: Blob, nombre = 'audio.webm'): Promise<string> {
  const fd = new FormData();
  fd.append('file', audio, nombre);
  fd.append('model', MODELO_TRANSCRIPCION);
  fd.append('language', 'es');
  fd.append('response_format', 'json');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave()}` },
    body: fd,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[transcribir]', res.status, t.slice(0, 300));
    throw new Error(mensajeDeErrorIA(res.status, t));
  }
  const j = await res.json();
  return String(j.text ?? '').trim();
}

// ── Embeddings ──────────────────────────────────────────────────────────────

export async function embeber(textos: string[]): Promise<number[][]> {
  if (!textos.length) return [];
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave()}` },
    body: JSON.stringify({ model: MODELO_EMBEDDINGS, input: textos }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[embeddings]', res.status, t.slice(0, 300));
    throw new Error(mensajeDeErrorIA(res.status, t));
  }
  const j = await res.json();
  return (j.data ?? []).map((d: any) => d.embedding as number[]);
}

export const aVector = (v: number[]) => `[${v.join(',')}]`;
