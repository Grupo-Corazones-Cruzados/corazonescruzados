// Capa de datos del sistema "Percepción Social" (Centralizado · colaborador · gestión).
// SQL crudo sobre el pool `pg` global (schema gcc_world). Prefijo de tablas: ps_.
// Modelo: una CAPTURA (ubicación + N fotos del entorno) que la IA analiza para producir
// ELEMENTOS (objeto/animal/persona) con propiedades libres. Las capturas son PRIVADAS por
// colaborador (cada quien ve las suyas; el admin ve todas) — el alcance se fuerza aquí.
import { pool } from '@/lib/db';

export type PsEstado = 'pendiente' | 'analizando' | 'analizado' | 'error';
export type PsCategoria = 'objeto' | 'animal' | 'persona';

export interface PsElementoInput {
  categoria: PsCategoria;
  nombre: string;
  confianza?: number | null;
  resumen?: string | null;
  propiedades?: Record<string, unknown>;
  foto_indices?: number[];
}

let ready = false;
let ensuring: Promise<void> | null = null;

export async function ensurePercepcionTables(): Promise<void> {
  if (ready) return;
  // Serializa el DDL: si ya hay un ensure en curso, esperamos ESE (varios fetch en paralelo
  // pueden chocar en CREATE TABLE/ALTER en Postgres). Mismo patrón que gestion-datos-db.
  if (ensuring) return ensuring;
  ensuring = doEnsure().then(() => { ready = true; }).finally(() => { ensuring = null; });
  return ensuring;
}

async function doEnsure(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.ps_capturas (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      accuracy DOUBLE PRECISION,
      direccion TEXT,
      estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      resumen TEXT,
      error TEXT,
      notas TEXT,
      capturado_en TIMESTAMPTZ DEFAULT NOW(),
      analizado_en TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ps_capturas_user_idx ON gcc_world.ps_capturas(user_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.ps_fotos (
      id SERIAL PRIMARY KEY,
      captura_id INT NOT NULL REFERENCES gcc_world.ps_capturas(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      orden INT DEFAULT 0
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ps_fotos_captura_idx ON gcc_world.ps_fotos(captura_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.ps_elementos (
      id SERIAL PRIMARY KEY,
      captura_id INT NOT NULL REFERENCES gcc_world.ps_capturas(id) ON DELETE CASCADE,
      categoria VARCHAR(20) NOT NULL,
      nombre TEXT NOT NULL,
      confianza INT,
      resumen TEXT,
      propiedades JSONB NOT NULL DEFAULT '{}'::jsonb,
      foto_indices INT[] NOT NULL DEFAULT '{}'::int[],
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ps_elementos_captura_idx ON gcc_world.ps_elementos(captura_id)`);
}

/** Cláusula de propiedad: un colaborador solo toca SUS capturas; el admin, todas. */
function ownerClause(userId: number, isAdmin: boolean, col = 'user_id'): { sql: string; params: any[] } {
  return isAdmin ? { sql: '', params: [] } : { sql: ` AND ${col} = $OWNER`, params: [userId] };
}

export async function createCaptura(
  userId: number,
  loc: { lat?: number | null; lng?: number | null; accuracy?: number | null; direccion?: string | null; notas?: string | null },
  fotos: string[],
): Promise<{ id: number }> {
  await ensurePercepcionTables();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO gcc_world.ps_capturas (user_id, lat, lng, accuracy, direccion, notas, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente') RETURNING id`,
      [userId, loc.lat ?? null, loc.lng ?? null, loc.accuracy ?? null, loc.direccion ?? null, loc.notas ?? null],
    );
    const capturaId = rows[0].id as number;
    for (let i = 0; i < fotos.length; i++) {
      await client.query(
        `INSERT INTO gcc_world.ps_fotos (captura_id, url, orden) VALUES ($1, $2, $3)`,
        [capturaId, fotos[i], i],
      );
    }
    await client.query('COMMIT');
    return { id: capturaId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listCapturas(userId: number, isAdmin: boolean): Promise<any[]> {
  await ensurePercepcionTables();
  const own = ownerClause(userId, isAdmin, 'c.user_id');
  const sql = `
    SELECT c.id, c.user_id, c.lat, c.lng, c.accuracy, c.direccion, c.estado, c.resumen,
           c.capturado_en, c.analizado_en,
           COALESCE(f.cnt, 0)::int AS fotos_count,
           COALESCE(e.cnt, 0)::int AS elementos_count,
           f.cover
    FROM gcc_world.ps_capturas c
    LEFT JOIN (
      SELECT captura_id, COUNT(*) AS cnt,
             (ARRAY_AGG(url ORDER BY orden))[1] AS cover
      FROM gcc_world.ps_fotos GROUP BY captura_id
    ) f ON f.captura_id = c.id
    LEFT JOIN (
      SELECT captura_id, COUNT(*) AS cnt FROM gcc_world.ps_elementos GROUP BY captura_id
    ) e ON e.captura_id = c.id
    WHERE 1=1${own.sql.replace('$OWNER', '$1')}
    ORDER BY c.capturado_en DESC`;
  const { rows } = await pool.query(sql, own.params);
  return rows;
}

export async function getCaptura(id: number, userId: number, isAdmin: boolean): Promise<any | null> {
  await ensurePercepcionTables();
  const own = ownerClause(userId, isAdmin);
  const { rows } = await pool.query(
    `SELECT * FROM gcc_world.ps_capturas WHERE id = $1${own.sql.replace('$OWNER', '$2')}`,
    isAdmin ? [id] : [id, userId],
  );
  const captura = rows[0];
  if (!captura) return null;
  const { rows: fotos } = await pool.query(
    `SELECT id, url, orden FROM gcc_world.ps_fotos WHERE captura_id = $1 ORDER BY orden`,
    [id],
  );
  const { rows: elementos } = await pool.query(
    `SELECT id, categoria, nombre, confianza, resumen, propiedades, foto_indices
     FROM gcc_world.ps_elementos WHERE captura_id = $1 ORDER BY categoria, id`,
    [id],
  );
  return { ...captura, fotos, elementos };
}

/** Fotos (urls ordenadas) de una captura, verificando propiedad. Para el análisis IA. */
export async function getCapturaFotos(id: number, userId: number, isAdmin: boolean): Promise<string[] | null> {
  await ensurePercepcionTables();
  const own = ownerClause(userId, isAdmin);
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.ps_capturas WHERE id = $1${own.sql.replace('$OWNER', '$2')}`,
    isAdmin ? [id] : [id, userId],
  );
  if (!rows.length) return null;
  const { rows: fotos } = await pool.query(
    `SELECT url FROM gcc_world.ps_fotos WHERE captura_id = $1 ORDER BY orden`,
    [id],
  );
  return fotos.map((f: { url: string }) => f.url);
}

export async function setCapturaEstado(id: number, estado: PsEstado): Promise<void> {
  await ensurePercepcionTables();
  await pool.query(`UPDATE gcc_world.ps_capturas SET estado = $2 WHERE id = $1`, [id, estado]);
}

/** Guarda el resultado del análisis: reemplaza elementos, fija resumen y estado 'analizado'. */
export async function setCapturaResultado(
  id: number,
  resumen: string,
  elementos: PsElementoInput[],
): Promise<void> {
  await ensurePercepcionTables();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM gcc_world.ps_elementos WHERE captura_id = $1`, [id]);
    for (const el of elementos) {
      await client.query(
        `INSERT INTO gcc_world.ps_elementos (captura_id, categoria, nombre, confianza, resumen, propiedades, foto_indices)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::int[])`,
        [
          id,
          el.categoria,
          el.nombre,
          el.confianza ?? null,
          el.resumen ?? null,
          JSON.stringify(el.propiedades ?? {}),
          el.foto_indices ?? [],
        ],
      );
    }
    await client.query(
      `UPDATE gcc_world.ps_capturas SET estado = 'analizado', resumen = $2, error = NULL, analizado_en = NOW() WHERE id = $1`,
      [id, resumen],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function setCapturaError(id: number, error: string): Promise<void> {
  await ensurePercepcionTables();
  await pool.query(
    `UPDATE gcc_world.ps_capturas SET estado = 'error', error = $2 WHERE id = $1`,
    [id, error.slice(0, 500)],
  );
}

export async function deleteCaptura(id: number, userId: number, isAdmin: boolean): Promise<boolean> {
  await ensurePercepcionTables();
  const own = ownerClause(userId, isAdmin);
  const { rowCount } = await pool.query(
    `DELETE FROM gcc_world.ps_capturas WHERE id = $1${own.sql.replace('$OWNER', '$2')}`,
    isAdmin ? [id] : [id, userId],
  );
  return (rowCount ?? 0) > 0;
}
