import { pool } from '@/lib/db';

/**
 * "Razones": cuaderno personal del administrador para registrar por qué trabaja en el
 * proyecto — sucesos, motivos de lucha — y releerlos cuando falte motivación. Igual que
 * "Pensamientos" pero SIN el análisis/clasificación por IA (no hay cron ni categorías).
 * Privado por fila: cada razón pertenece a un `user_id` y solo su dueño la ve/edita.
 */
let ensuring: Promise<void> | null = null;
export function ensureRazonesTable(): Promise<void> {
  if (ensuring) return ensuring;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.razones (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        char_count INT NOT NULL DEFAULT 0,
        day DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS razones_user_day_idx ON gcc_world.razones(user_id, day);
    `)
    .then(() => undefined)
    .catch((err: unknown) => { ensuring = null; throw err; });
  ensuring = p;
  return p;
}

const ROW = `id, content, char_count AS "charCount", to_char(day, 'YYYY-MM-DD') AS day,
             created_at AS "createdAt", updated_at AS "updatedAt"`;

/** Días con razones del usuario, con su conteo. */
export async function listDays(userId: string) {
  await ensureRazonesTable();
  const { rows } = await pool.query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count, COALESCE(SUM(char_count), 0)::int AS chars
       FROM gcc_world.razones WHERE user_id = $1 GROUP BY day ORDER BY day DESC`,
    [userId],
  );
  return rows;
}

/** Razones del día pedido, o las 50 más recientes si no se pasa día. */
export async function listRazones(userId: string, day?: string) {
  await ensureRazonesTable();
  if (day) {
    const { rows } = await pool.query(
      `SELECT ${ROW} FROM gcc_world.razones WHERE user_id = $1 AND day = $2 ORDER BY created_at DESC`,
      [userId, day],
    );
    return rows;
  }
  const { rows } = await pool.query(
    `SELECT ${ROW} FROM gcc_world.razones WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );
  return rows;
}

export async function createRazon(userId: string, content: string) {
  await ensureRazonesTable();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.razones (user_id, content, char_count, day)
     VALUES ($1, $2, $3, (NOW() AT TIME ZONE 'America/Guayaquil')::date)
     RETURNING ${ROW}`,
    [userId, content, content.length],
  );
  return rows[0];
}

export async function updateRazon(userId: string, id: string, content: string) {
  await ensureRazonesTable();
  const { rows } = await pool.query(
    `UPDATE gcc_world.razones SET content = $1, char_count = $2, updated_at = NOW()
      WHERE id = $3 AND user_id = $4 RETURNING ${ROW}`,
    [content, content.length, id, userId],
  );
  return rows[0] || null;
}

export async function deleteRazon(userId: string, id: string) {
  await ensureRazonesTable();
  await pool.query(`DELETE FROM gcc_world.razones WHERE id = $1 AND user_id = $2`, [id, userId]);
}
