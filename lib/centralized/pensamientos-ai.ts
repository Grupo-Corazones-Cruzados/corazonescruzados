import { CATEGORIES_SET } from '@/lib/centralized/pensamientos';
import type { PendingThought } from '@/lib/centralized/pensamientos-db';
import { chatJSON } from '@/lib/ia/openai';

/**
 * Clasificador de pensamientos con OpenAI. Asigna a cada pensamiento UNA de las 4
 * dimensiones del desarrollo (las mismas de `apoyo.ts`).
 *
 * Sigue el patrón de la casa: la llamada la hace `lib/ia/openai.ts` —la ÚNICA capa que
 * habla con el modelo— con `response_format: json_object`, la estructura descrita en prosa
 * en el system prompt, y validación a mano de lo que vuelve.
 *
 * Se clasifica POR LOTES (varios pensamientos en una sola llamada) porque una llamada por
 * pensamiento multiplicaría el coste y la latencia del trabajo nocturno sin ganar precisión.
 */

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
  const payload = items.map((t) => ({ id: t.id, texto: (t.content || '').slice(0, MAX_CHARS) }));

  // El techo es amplio a propósito: son hasta 20 pensamientos por llamada y en este modelo
  // el razonamiento CUENTA dentro de `max_completion_tokens`. Quedarse corto no da error,
  // devuelve la respuesta cortada — que es peor.
  const parsed = await chatJSON<any>({
    system: SYSTEM_PROMPT,
    user: `Clasifica estos pensamientos:\n\n${JSON.stringify(payload)}`,
    maxTokens: 4000,
    esfuerzo: 'low',
    etiqueta: 'pensamientos',
  });

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
