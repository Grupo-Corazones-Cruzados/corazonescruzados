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
      user_id TEXT NOT NULL,
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
      claimed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // claimed_at: marca cuándo el worker local tomó la captura (para re-encolar las que quedaron colgadas).
  await pool.query(`ALTER TABLE gcc_world.ps_capturas ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ`);
  // users.id es UUID → user_id debe ser TEXT (una versión temprana lo creó como INT). Migración idempotente.
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='gcc_world' AND table_name='ps_capturas' AND column_name='user_id'
          AND data_type <> 'text'
      ) THEN
        ALTER TABLE gcc_world.ps_capturas ALTER COLUMN user_id TYPE TEXT USING user_id::text;
      END IF;
    END $$;
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ps_capturas_user_idx ON gcc_world.ps_capturas(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ps_capturas_estado_idx ON gcc_world.ps_capturas(estado)`);
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
function ownerClause(userId: string, isAdmin: boolean, col = 'user_id'): { sql: string; params: any[] } {
  return isAdmin ? { sql: '', params: [] } : { sql: ` AND ${col} = $OWNER`, params: [userId] };
}

export async function createCaptura(
  userId: string,
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

export async function listCapturas(userId: string, isAdmin: boolean): Promise<any[]> {
  await ensurePercepcionTables();
  const own = ownerClause(userId, isAdmin, 'c.user_id');
  const sql = `
    SELECT c.id, c.user_id, c.lat, c.lng, c.accuracy, c.direccion, c.estado, c.resumen,
           c.capturado_en, c.analizado_en,
           COALESCE(f.cnt, 0)::int AS fotos_count,
           COALESCE(e.cnt, 0)::int AS elementos_count,
           COALESCE(e.objetos, 0)::int AS objetos_count,
           COALESCE(e.personas, 0)::int AS personas_count,
           COALESCE(e.animales, 0)::int AS animales_count,
           f.cover
    FROM gcc_world.ps_capturas c
    LEFT JOIN (
      SELECT captura_id, COUNT(*) AS cnt,
             (ARRAY_AGG(url ORDER BY orden))[1] AS cover
      FROM gcc_world.ps_fotos GROUP BY captura_id
    ) f ON f.captura_id = c.id
    LEFT JOIN (
      SELECT captura_id, COUNT(*) AS cnt,
             COUNT(*) FILTER (WHERE categoria = 'objeto')  AS objetos,
             COUNT(*) FILTER (WHERE categoria = 'persona') AS personas,
             COUNT(*) FILTER (WHERE categoria = 'animal')  AS animales
      FROM gcc_world.ps_elementos GROUP BY captura_id
    ) e ON e.captura_id = c.id
    WHERE 1=1${own.sql.replace('$OWNER', '$1')}
    ORDER BY c.capturado_en DESC`;
  const { rows } = await pool.query(sql, own.params);
  return rows;
}

export async function getCaptura(id: number, userId: string, isAdmin: boolean): Promise<any | null> {
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
export async function getCapturaFotos(id: number, userId: string, isAdmin: boolean): Promise<string[] | null> {
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

/**
 * El WORKER LOCAL reclama capturas pendientes para analizarlas con el Claude CLI. Marca las tomadas
 * como 'analizando' (con claimed_at) de forma atómica (FOR UPDATE SKIP LOCKED → apto para varios
 * workers). Re-reclama las 'analizando' colgadas hace >10 min (worker caído a mitad). Devuelve, por
 * captura, sus fotos (URLs). El alcance NO es por usuario: el worker procesa las de todos.
 */
export async function claimForWorker(limit: number): Promise<{ id: number; fotos: string[] }[]> {
  await ensurePercepcionTables();
  const { rows } = await pool.query(
    `UPDATE gcc_world.ps_capturas SET estado = 'analizando', claimed_at = NOW()
     WHERE id IN (
       SELECT id FROM gcc_world.ps_capturas
       WHERE estado = 'pendiente'
          OR (estado = 'analizando' AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '10 minutes'))
       ORDER BY capturado_en ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id`,
    [Math.max(1, Math.min(20, limit || 3))],
  );
  const ids: number[] = rows.map((r: { id: number }) => r.id);
  if (!ids.length) return [];
  const { rows: fotoRows } = await pool.query(
    `SELECT captura_id, url FROM gcc_world.ps_fotos WHERE captura_id = ANY($1::int[]) ORDER BY captura_id, orden`,
    [ids],
  );
  const map = new Map<number, string[]>();
  ids.forEach((id) => map.set(id, []));
  for (const fr of fotoRows as { captura_id: number; url: string }[]) map.get(fr.captura_id)?.push(fr.url);
  return ids.map((id) => ({ id, fotos: map.get(id) || [] }));
}

/** Re-encola una captura (error/colgada) para que el worker la vuelva a tomar. Respeta propiedad. */
export async function requeueCaptura(id: number, userId: string, isAdmin: boolean): Promise<boolean> {
  await ensurePercepcionTables();
  const own = ownerClause(userId, isAdmin);
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.ps_capturas SET estado = 'pendiente', error = NULL, claimed_at = NULL WHERE id = $1${own.sql.replace('$OWNER', '$2')}`,
    isAdmin ? [id] : [id, userId],
  );
  return (rowCount ?? 0) > 0;
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

export async function deleteCaptura(id: number, userId: string, isAdmin: boolean): Promise<boolean> {
  await ensurePercepcionTables();
  const own = ownerClause(userId, isAdmin);
  const { rowCount } = await pool.query(
    `DELETE FROM gcc_world.ps_capturas WHERE id = $1${own.sql.replace('$OWNER', '$2')}`,
    isAdmin ? [id] : [id, userId],
  );
  return (rowCount ?? 0) > 0;
}
