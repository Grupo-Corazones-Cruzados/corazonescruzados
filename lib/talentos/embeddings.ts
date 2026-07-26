import { pool } from '@/lib/db';

/**
 * BÚSQUEDA SEMÁNTICA DE TALENTOS (embeddings + pgvector).
 *
 * Para qué: el agente de cotizaciones describe un requerimiento con sus palabras
 * ("app móvil para vendedores", "que las pantallas se vean bien") y necesita elegir el
 * talento EXACTO de `gd_talentos`. La búsqueda por texto no sirve — se midió: "app movil",
 * "pantallas bonitas" y "automatizar tareas repetitivas" devuelven CERO resultados con
 * trigramas, porque no comparten palabras con el nombre del talento. Con embeddings sí.
 *
 * Modelo: `text-embedding-3-small` de OpenAI (1536 dimensiones). Se eligió porque la clave
 * de OpenAI ya está en el proyecto, cuesta centavos indexar 525 talentos y su calidad sobra
 * para textos de 2-3 palabras.
 *
 * Almacenamiento: columna `embedding vector(1536)` en la propia `gd_talentos` (extensión
 * `vector`, ya habilitada). Con 525 filas la distancia se calcula al instante, así que no
 * hace falta índice ANN; se añade igual por si la lista crece.
 *
 * Mantenimiento: se reindexa lo que esté sin vector. Al añadir o renombrar un talento su
 * vector queda a NULL y la siguiente búsqueda lo recalcula (ver `reindexPending`).
 */

const MODEL = 'text-embedding-3-small';
const DIMS = 1536;

export function embeddingsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let ready = false;
let ensuring: Promise<void> | null = null;

/** Extensión, columna e índice. Idempotente. */
export function ensureTalentEmbeddings(): Promise<void> {
  if (ready) return Promise.resolve();
  if (ensuring) return ensuring;
  ensuring = (async () => {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pool.query(`ALTER TABLE gcc_world.gd_talentos ADD COLUMN IF NOT EXISTS embedding vector(${DIMS})`);
    await pool.query(`ALTER TABLE gcc_world.gd_talentos ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ`);
    // Texto EXACTO con el que se calculó el vector. Comparándolo con `nombre` se detecta
    // cualquier renombrado, venga de donde venga (la pestaña Fuentes edita la tabla
    // directamente, y ahí no pasa por `updateListOption`).
    await pool.query(`ALTER TABLE gcc_world.gd_talentos ADD COLUMN IF NOT EXISTS embedded_text TEXT`);
    // Con 525 filas no es necesario, pero deja el camino hecho si la lista crece.
    await pool.query(`CREATE INDEX IF NOT EXISTS gd_talentos_embedding_idx
                        ON gcc_world.gd_talentos USING hnsw (embedding vector_cosine_ops)`)
      .catch(() => { /* hnsw necesita pgvector >= 0.5; sin índice sigue funcionando */ });
    ready = true;
  })().finally(() => { ensuring = null; });
  return ensuring;
}

/** Pide los vectores a OpenAI. Lanza si no hay clave o si la API falla. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!embeddingsConfigured()) throw new Error('Falta OPENAI_API_KEY para calcular embeddings.');
  if (!texts.length) return [];
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenAI embeddings ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  return (j.data || []).map((d: any) => d.embedding as number[]);
}

const toVector = (v: number[]) => `[${v.join(',')}]`;

/** Cuántos talentos están pendientes de vector (nuevos o con el nombre cambiado). */
export async function countPending(): Promise<number> {
  await ensureTalentEmbeddings();
  const { rows: [r] } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM gcc_world.gd_talentos
      WHERE embedding IS NULL OR embedded_text IS DISTINCT FROM nombre`);
  return Number(r.n);
}

/**
 * Calcula los vectores que falten: los NUEVOS (sin embedding) y los RENOMBRADOS (el texto
 * embebido ya no coincide con el nombre actual). Devuelve cuántos indexó.
 * Es la única función que gasta API.
 */
export async function reindexPending(limit = 1000): Promise<number> {
  await ensureTalentEmbeddings();
  const { rows } = await pool.query(
    `SELECT id, nombre FROM gcc_world.gd_talentos
      WHERE embedding IS NULL OR embedded_text IS DISTINCT FROM nombre
      ORDER BY id LIMIT $1`, [limit]);
  if (!rows.length) return 0;

  let done = 0;
  const BATCH = 128;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const vectors = await embedTexts(slice.map((r: any) => r.nombre));
    for (let k = 0; k < slice.length; k++) {
      if (!vectors[k]) continue;
      await pool.query(
        `UPDATE gcc_world.gd_talentos
            SET embedding = $1::vector, embedded_at = NOW(), embedded_text = $3
          WHERE id = $2`,
        [toVector(vectors[k]), slice[k].id, slice[k].nombre],
      );
      done++;
    }
  }
  return done;
}

/** Marca un talento para reindexar (se llama al crear/renombrar uno). */
export async function invalidateTalentEmbedding(id: number): Promise<void> {
  await ensureTalentEmbeddings();
  await pool.query(`UPDATE gcc_world.gd_talentos SET embedding = NULL, embedded_at = NULL WHERE id = $1`, [id]);
}

export interface TalentMatch { nombre: string; score: number }

/**
 * Talentos más parecidos a `query`, por similitud coseno. `score` de 0 a 1 (1 = idéntico).
 * Si no hay embeddings disponibles cae a búsqueda por texto, para degradar en vez de fallar.
 */
export async function searchTalentos(query: string, k = 8): Promise<TalentMatch[]> {
  const q = (query || '').trim();
  if (!q) return [];
  await ensureTalentEmbeddings();

  if (embeddingsConfigured()) {
    try {
      await reindexPending();                       // los nuevos entran solos
      const [vec] = await embedTexts([q]);
      if (vec) {
        const { rows } = await pool.query(
          `SELECT nombre, 1 - (embedding <=> $1::vector) AS score
             FROM gcc_world.gd_talentos
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT $2`,
          [toVector(vec), k],
        );
        return rows.map((r: any) => ({ nombre: r.nombre, score: Number(Number(r.score).toFixed(4)) }));
      }
    } catch (err: any) {
      console.error('searchTalentos (embeddings) falló, se usa texto:', err.message);
    }
  }

  // Respaldo por texto: peor calidad (no entiende paráfrasis) pero nunca deja al agente sin nada.
  const { rows } = await pool.query(
    `SELECT nombre, GREATEST(similarity(LOWER(nombre), LOWER($1)), 0) AS score
       FROM gcc_world.gd_talentos
      WHERE LOWER(nombre) % LOWER($1) OR LOWER(nombre) ILIKE '%' || LOWER($1) || '%'
      ORDER BY score DESC LIMIT $2`,
    [q, k],
  );
  return rows.map((r: any) => ({ nombre: r.nombre, score: Number(Number(r.score).toFixed(4)) }));
}
