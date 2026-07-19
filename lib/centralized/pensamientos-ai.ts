import { CATEGORIES_SET } from '@/lib/centralized/pensamientos';
import type { PendingThought } from '@/lib/centralized/pensamientos-db';

/**
 * Clasificador de pensamientos con OpenAI. Asigna a cada pensamiento UNA de las 4
 * dimensiones del desarrollo (las mismas de `apoyo.ts`).
 *
 * Sigue el patrón de la casa (`lib/openai.ts`, `apa-extract/route.ts`): `fetch` directo a
 * /v1/chat/completions con `response_format: json_object`, la estructura descrita en prosa
 * en el system prompt, y validación a mano tras el `JSON.parse`.
 *
 * Se clasifica POR LOTES (varios pensamientos en una sola llamada) porque una llamada por
 * pensamiento multiplicaría el coste y la latencia del trabajo nocturno sin ganar precisión.
 */

const MODEL = 'gpt-4o-mini';
/** Nº de pensamientos por llamada. Suficientemente pequeño para no desbordar el contexto. */
export const BATCH_SIZE = 20;
/** Recorte por pensamiento: una "lectura amplia" puede ser larguísima y el inicio ya define el tema. */
const MAX_CHARS = 4000;

const SYSTEM_PROMPT = `Eres un clasificador de "pensamientos" personales escritos en español. Cada pensamiento debe recibir EXACTAMENTE UNA de estas cuatro categorías:

- "mental": interés filosófico, salud mental, introspección, reflexión sobre la vida, emociones, sentido, creencias.
- "social": sobre las personas, los vínculos, la realidad social, la sociedad, la comunidad, la convivencia.
- "laboral": lecciones sobre relaciones laborales, trabajo, motivación para cumplir metas laborales o proyectos personales, productividad, carrera.
- "corporal": salud física, autocuidado del cuerpo, alimentación, medicación, ejercicio, descanso, síntomas y salud corporal en general.

Devuelve un objeto JSON con esta estructura exacta:
{ "resultados": [ { "id": <number>, "categoria": "mental" | "social" | "laboral" | "corporal" } ] }

Reglas:
- Devuelve un elemento por CADA id que recibas, con el MISMO id.
- Elige siempre la categoría DOMINANTE; nunca devuelvas más de una ni una vacía.
- Si un pensamiento es ambiguo o muy corto, elige la más plausible; no lo omitas.
- No añadas explicaciones ni ningún campo extra.`;

export interface ClassifyResult { id: number; category: string }

/** Clasifica un lote. Devuelve solo los resultados con id e id de categoría válidos. */
export async function classifyBatch(items: PendingThought[]): Promise<ClassifyResult[]> {
  if (items.length === 0) return [];
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI no está configurado (falta OPENAI_API_KEY)');

  const payload = items.map((t) => ({ id: t.id, texto: (t.content || '').slice(0, MAX_CHARS) }));

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Clasifica estos pensamientos:\n\n${JSON.stringify(payload)}` },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Pensamientos OpenAI error:', res.status, err.slice(0, 300));
    throw new Error(`OpenAI respondió ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Respuesta vacía del modelo');

  let parsed: any;
  try { parsed = JSON.parse(content); } catch { throw new Error('El modelo no devolvió JSON válido'); }

  const sent = new Set(items.map((t) => t.id));
  const out: ClassifyResult[] = [];
  for (const r of Array.isArray(parsed?.resultados) ? parsed.resultados : []) {
    const id = Number(r?.id);
    const category = String(r?.categoria || '').toLowerCase().trim();
    // Se descarta cualquier id que no pedimos o categoría fuera de la lista canónica.
    if (sent.has(id) && CATEGORIES_SET.has(category)) out.push({ id, category });
  }
  return out;
}
