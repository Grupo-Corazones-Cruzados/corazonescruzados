/**
 * Capa de datos del sistema «Generación de Contenido» (Centralizado · colaborador · gestión).
 * SQL crudo sobre el pool `pg` (schema `gcc_world`). Prefijo de tablas: **gcont_**.
 *
 * ⚠️ `gc_` NO está libre: es de Gestión de Condiciones (gc_condiciones, gc_requerimientos…).
 *
 * ALCANCE: las ideas son PRIVADAS por colaborador — cada quien ve las suyas y el admin ve
 * todas (Fernando, 2026-09-06). El alcance se fuerza AQUÍ, en cada consulta, no en la
 * pantalla: una pantalla se puede saltar escribiendo la URL.
 */
import { pool } from '@/lib/db';
import {
  CARRUSEL_MAX_LAMINAS, CLAVES_PROMPT, TONOS_SEMILLA, promptPorDefecto,
  type ContenidoEstado, type EntregableTipo, type FuenteTipo, type LaminaRol, type ReferenciaTipo,
} from '@/lib/centralized/generacion-contenido';

let ready = false;
let ensuring: Promise<void> | null = null;

/**
 * DDL idempotente. Es el espejo de `sql/migrations/061_generacion_de_contenido.sql`: la
 * migración es la fuente versionada, y esto hace que la pantalla funcione en una base que
 * todavía no la haya recibido. Se serializa porque la pantalla dispara varias peticiones a
 * la vez y en Postgres dos CREATE TABLE simultáneos chocan.
 */
export async function ensureGeneracionContenidoTables(): Promise<void> {
  if (ready) return;
  if (ensuring) return ensuring;
  ensuring = doEnsure().then(() => { ready = true; }).finally(() => { ensuring = null; });
  return ensuring;
}

async function doEnsure(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gcont_contenidos (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      member_id BIGINT,
      titulo TEXT,
      tema TEXT NOT NULL,
      proposito_social TEXT NOT NULL DEFAULT '',
      proposito_monetario TEXT NOT NULL DEFAULT '',
      desarrollo TEXT NOT NULL DEFAULT '',
      talento TEXT,
      estado TEXT NOT NULL DEFAULT 'en_desarrollo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gcont_contenidos_user_idx ON gcc_world.gcont_contenidos(user_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gcont_referencias (
      id SERIAL PRIMARY KEY,
      contenido_id INT NOT NULL REFERENCES gcc_world.gcont_contenidos(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      ref_id BIGINT NOT NULL,
      titulo TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (contenido_id, tipo, ref_id)
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gcont_referencias_cont_idx ON gcc_world.gcont_referencias(contenido_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gcont_fuentes (
      id SERIAL PRIMARY KEY,
      contenido_id INT NOT NULL REFERENCES gcc_world.gcont_contenidos(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      ref_id BIGINT NOT NULL,
      etiqueta TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (contenido_id, tipo, ref_id)
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gcont_fuentes_cont_idx ON gcc_world.gcont_fuentes(contenido_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gcont_tonos (
      id SERIAL PRIMARY KEY,
      contenido_id INT NOT NULL REFERENCES gcc_world.gcont_contenidos(id) ON DELETE CASCADE,
      tono TEXT NOT NULL,
      UNIQUE (contenido_id, tono)
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gcont_entregables (
      id SERIAL PRIMARY KEY,
      contenido_id INT NOT NULL REFERENCES gcc_world.gcont_contenidos(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      texto TEXT NOT NULL DEFAULT '',
      datos JSONB NOT NULL DEFAULT '{}'::jsonb,
      editado BOOLEAN NOT NULL DEFAULT FALSE,
      generado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (contenido_id, tipo)
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gcont_laminas (
      id SERIAL PRIMARY KEY,
      contenido_id INT NOT NULL REFERENCES gcc_world.gcont_contenidos(id) ON DELETE CASCADE,
      orden INT NOT NULL DEFAULT 0,
      rol TEXT NOT NULL DEFAULT 'desarrollo',
      titulo TEXT NOT NULL DEFAULT '',
      texto TEXT NOT NULL DEFAULT '',
      prompt_visual TEXT NOT NULL DEFAULT '',
      imagen_url TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (contenido_id, orden)
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gcont_laminas_cont_idx ON gcc_world.gcont_laminas(contenido_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gcont_prompts (
      clave TEXT PRIMARY KEY,
      texto TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    )`);
  // Semilla de los prompts: solo los que falten. Nunca pisa uno que Fernando ya editó.
  for (const clave of CLAVES_PROMPT) {
    await pool.query(
      `INSERT INTO gcc_world.gcont_prompts (clave, texto) VALUES ($1, $2)
       ON CONFLICT (clave) DO NOTHING`,
      [clave, promptPorDefecto(clave)],
    );
  }

  // Lista global de tonos (su hogar es Encuadre Condiciológico; aquí solo se garantiza).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gd_tonos (
      id SERIAL PRIMARY KEY, nombre TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  const { rows: [t] } = await pool.query(`SELECT COUNT(*)::int AS n FROM gcc_world.gd_tonos`);
  if (t.n === 0) {
    await pool.query(
      `INSERT INTO gcc_world.gd_tonos (nombre) SELECT DISTINCT unnest($1::text[]) ON CONFLICT (nombre) DO NOTHING`,
      [TONOS_SEMILLA],
    );
  }
}

/** Alcance del dueño: el admin lo ve todo; el resto, solo lo suyo. */
function ownerClause(userId: string, isAdmin: boolean, col = 'user_id'): string {
  return isAdmin ? '' : ` AND ${col} = $OWNER`;
}

/* ── El miembro detrás del usuario ────────────────────────────────────────────── */
export async function memberIdDeUsuario(userId: string): Promise<number | null> {
  const { rows } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
  return rows[0]?.member_id ?? null;
}

/* ── Contenidos ───────────────────────────────────────────────────────────────── */
export interface ContenidoInput {
  tema: string;
  proposito_social?: string;
  proposito_monetario?: string;
  desarrollo?: string;
  talento?: string | null;
  tonos?: string[];
  referencias?: { tipo: ReferenciaTipo; ref_id: number; titulo: string }[];
  fuentes?: { tipo: FuenteTipo; ref_id: number; etiqueta: string }[];
}

/** La lista del panel izquierdo: fecha, título y de un vistazo cuánto está hecho. */
export async function listContenidos(userId: string, isAdmin: boolean) {
  await ensureGeneracionContenidoTables();
  const sql = `
    SELECT c.id, c.titulo, c.tema, c.estado, c.talento, c.created_at, c.updated_at,
           COALESCE(e.cnt, 0)::int AS entregables_count,
           COALESCE(l.cnt, 0)::int AS laminas_count,
           COALESCE(l.con_imagen, 0)::int AS laminas_con_imagen
      FROM gcc_world.gcont_contenidos c
      LEFT JOIN (SELECT contenido_id, COUNT(*) AS cnt FROM gcc_world.gcont_entregables GROUP BY contenido_id) e
             ON e.contenido_id = c.id
      LEFT JOIN (SELECT contenido_id, COUNT(*) AS cnt,
                        COUNT(*) FILTER (WHERE imagen_url IS NOT NULL) AS con_imagen
                   FROM gcc_world.gcont_laminas GROUP BY contenido_id) l
             ON l.contenido_id = c.id
     WHERE 1=1${ownerClause(userId, isAdmin, 'c.user_id').replace('$OWNER', '$1')}
     ORDER BY c.created_at DESC`;
  const { rows } = await pool.query(sql, isAdmin ? [] : [userId]);
  return rows;
}

/** Todo lo de una idea: la idea, lo que se le dio de contexto y lo que el agente devolvió. */
export async function getContenido(id: number, userId: string, isAdmin: boolean) {
  await ensureGeneracionContenidoTables();
  const { rows } = await pool.query(
    `SELECT * FROM gcc_world.gcont_contenidos WHERE id = $1${ownerClause(userId, isAdmin).replace('$OWNER', '$2')}`,
    isAdmin ? [id] : [id, userId],
  );
  const contenido = rows[0];
  if (!contenido) return null;

  const [refs, fuentes, tonos, entregables, laminas] = await Promise.all([
    pool.query(`SELECT id, tipo, ref_id, titulo FROM gcc_world.gcont_referencias WHERE contenido_id = $1 ORDER BY id`, [id]),
    pool.query(`SELECT id, tipo, ref_id, etiqueta FROM gcc_world.gcont_fuentes WHERE contenido_id = $1 ORDER BY id`, [id]),
    pool.query(`SELECT tono FROM gcc_world.gcont_tonos WHERE contenido_id = $1 ORDER BY tono`, [id]),
    pool.query(`SELECT id, tipo, texto, datos, editado, generado_en, updated_at FROM gcc_world.gcont_entregables WHERE contenido_id = $1`, [id]),
    pool.query(`SELECT id, orden, rol, titulo, texto, prompt_visual, imagen_url, error FROM gcc_world.gcont_laminas WHERE contenido_id = $1 ORDER BY orden`, [id]),
  ]);

  return {
    ...contenido,
    referencias: refs.rows,
    fuentes: fuentes.rows,
    tonos: tonos.rows.map((r: any) => r.tono),
    entregables: entregables.rows,
    laminas: laminas.rows,
  };
}

export async function createContenido(userId: string, memberId: number | null, input: ContenidoInput) {
  await ensureGeneracionContenidoTables();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO gcc_world.gcont_contenidos
         (user_id, member_id, tema, proposito_social, proposito_monetario, desarrollo, talento)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [userId, memberId, input.tema, input.proposito_social ?? '', input.proposito_monetario ?? '',
       input.desarrollo ?? '', input.talento ?? null],
    );
    const contenidoId = rows[0].id as number;
    await guardarContexto(client, contenidoId, input);
    await client.query('COMMIT');
    return { id: contenidoId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Reescribe el contexto elegido (tonos, referencias, fuentes) para un contenido.
 *
 * Se borra y se vuelve a insertar dentro de la MISMA transacción que la fila padre. La
 * lección ya está escrita en la memoria del proyecto: antes de colgar algo en cascada, mirar
 * cómo se guarda la fila padre. Aquí el padre y sus hijos viajan juntos o no viajan.
 */
async function guardarContexto(client: any, contenidoId: number, input: Partial<ContenidoInput>) {
  if (input.tonos) {
    await client.query(`DELETE FROM gcc_world.gcont_tonos WHERE contenido_id = $1`, [contenidoId]);
    for (const tono of input.tonos) {
      if (!tono?.trim()) continue;
      await client.query(
        `INSERT INTO gcc_world.gcont_tonos (contenido_id, tono) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [contenidoId, tono.trim()],
      );
    }
  }
  if (input.referencias) {
    await client.query(`DELETE FROM gcc_world.gcont_referencias WHERE contenido_id = $1`, [contenidoId]);
    for (const r of input.referencias) {
      await client.query(
        `INSERT INTO gcc_world.gcont_referencias (contenido_id, tipo, ref_id, titulo)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [contenidoId, r.tipo, r.ref_id, r.titulo ?? ''],
      );
    }
  }
  if (input.fuentes) {
    await client.query(`DELETE FROM gcc_world.gcont_fuentes WHERE contenido_id = $1`, [contenidoId]);
    for (const f of input.fuentes) {
      await client.query(
        `INSERT INTO gcc_world.gcont_fuentes (contenido_id, tipo, ref_id, etiqueta)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [contenidoId, f.tipo, f.ref_id, f.etiqueta ?? ''],
      );
    }
  }
}

/** ¿Este usuario manda sobre esta idea? Se comprueba antes de cualquier escritura. */
export async function puedeEditar(id: number, userId: string, isAdmin: boolean): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.gcont_contenidos WHERE id = $1${ownerClause(userId, isAdmin).replace('$OWNER', '$2')}`,
    isAdmin ? [id] : [id, userId],
  );
  return rows.length > 0;
}

export async function updateContenido(
  id: number, userId: string, isAdmin: boolean,
  patch: Partial<ContenidoInput> & { estado?: ContenidoEstado; titulo?: string },
): Promise<boolean> {
  await ensureGeneracionContenidoTables();
  if (!(await puedeEditar(id, userId, isAdmin))) return false;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sets: string[] = [];
    const params: any[] = [];
    const set = (col: string, val: any) => { params.push(val); sets.push(`${col} = $${params.length}`); };
    if (patch.tema !== undefined) set('tema', patch.tema);
    if (patch.proposito_social !== undefined) set('proposito_social', patch.proposito_social);
    if (patch.proposito_monetario !== undefined) set('proposito_monetario', patch.proposito_monetario);
    if (patch.desarrollo !== undefined) set('desarrollo', patch.desarrollo);
    if (patch.talento !== undefined) set('talento', patch.talento);
    if (patch.estado !== undefined) set('estado', patch.estado);
    if (patch.titulo !== undefined) set('titulo', patch.titulo);
    if (sets.length) {
      params.push(id);
      await client.query(
        `UPDATE gcc_world.gcont_contenidos SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
        params,
      );
    }
    await guardarContexto(client, id, patch);
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteContenido(id: number, userId: string, isAdmin: boolean): Promise<boolean> {
  await ensureGeneracionContenidoTables();
  const { rowCount } = await pool.query(
    `DELETE FROM gcc_world.gcont_contenidos WHERE id = $1${ownerClause(userId, isAdmin).replace('$OWNER', '$2')}`,
    isAdmin ? [id] : [id, userId],
  );
  return (rowCount ?? 0) > 0;
}

/* ── Entregables ──────────────────────────────────────────────────────────────── */
export async function guardarEntregable(
  contenidoId: number, tipo: EntregableTipo, texto: string, datos: any,
) {
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gcont_entregables (contenido_id, tipo, texto, datos, editado, generado_en, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, FALSE, NOW(), NOW())
     ON CONFLICT (contenido_id, tipo) DO UPDATE
       SET texto = EXCLUDED.texto, datos = EXCLUDED.datos, editado = FALSE,
           generado_en = NOW(), updated_at = NOW()
     RETURNING id, tipo, texto, datos, editado, generado_en, updated_at`,
    [contenidoId, tipo, texto, JSON.stringify(datos ?? {})],
  );
  return rows[0];
}

/** La corrección a mano de un guion. Deja marcado `editado` para avisar antes de pisarlo. */
export async function editarEntregable(
  entregableId: number, userId: string, isAdmin: boolean, texto: string,
): Promise<any | null> {
  await ensureGeneracionContenidoTables();
  const { rows: [e] } = await pool.query(
    `SELECT e.id, e.contenido_id FROM gcc_world.gcont_entregables e
       JOIN gcc_world.gcont_contenidos c ON c.id = e.contenido_id
      WHERE e.id = $1${ownerClause(userId, isAdmin, 'c.user_id').replace('$OWNER', '$2')}`,
    isAdmin ? [entregableId] : [entregableId, userId],
  );
  if (!e) return null;
  const { rows } = await pool.query(
    `UPDATE gcc_world.gcont_entregables SET texto = $2, editado = TRUE, updated_at = NOW()
      WHERE id = $1 RETURNING id, tipo, texto, datos, editado, generado_en, updated_at`,
    [entregableId, texto],
  );
  await pool.query(`UPDATE gcc_world.gcont_contenidos SET updated_at = NOW() WHERE id = $1`, [e.contenido_id]);
  return rows[0];
}

export async function getEntregable(contenidoId: number, tipo: EntregableTipo) {
  const { rows } = await pool.query(
    `SELECT id, tipo, texto, datos, editado FROM gcc_world.gcont_entregables
      WHERE contenido_id = $1 AND tipo = $2`,
    [contenidoId, tipo],
  );
  return rows[0] ?? null;
}

/* ── Láminas del carrusel ─────────────────────────────────────────────────────── */
export async function reemplazarLaminas(
  contenidoId: number,
  laminas: { rol: LaminaRol; titulo: string; texto: string; prompt_visual: string }[],
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM gcc_world.gcont_laminas WHERE contenido_id = $1`, [contenidoId]);
    const recorte = laminas.slice(0, CARRUSEL_MAX_LAMINAS);
    for (let i = 0; i < recorte.length; i++) {
      const l = recorte[i];
      await client.query(
        `INSERT INTO gcc_world.gcont_laminas (contenido_id, orden, rol, titulo, texto, prompt_visual)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [contenidoId, i, l.rol || 'desarrollo', l.titulo ?? '', l.texto ?? '', l.prompt_visual ?? ''],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getLamina(laminaId: number, userId: string, isAdmin: boolean) {
  const { rows } = await pool.query(
    `SELECT l.* FROM gcc_world.gcont_laminas l
       JOIN gcc_world.gcont_contenidos c ON c.id = l.contenido_id
      WHERE l.id = $1${ownerClause(userId, isAdmin, 'c.user_id').replace('$OWNER', '$2')}`,
    isAdmin ? [laminaId] : [laminaId, userId],
  );
  return rows[0] ?? null;
}

export async function setLaminaImagen(laminaId: number, url: string | null, error: string | null) {
  await pool.query(
    `UPDATE gcc_world.gcont_laminas SET imagen_url = $2, error = $3 WHERE id = $1`,
    [laminaId, url, error],
  );
}

/* ── Prompts (lo que edita el botón de configuración) ─────────────────────────── */
export async function getPrompts(): Promise<Record<string, string>> {
  await ensureGeneracionContenidoTables();
  const { rows } = await pool.query(`SELECT clave, texto FROM gcc_world.gcont_prompts`);
  const out: Record<string, string> = {};
  for (const clave of CLAVES_PROMPT) out[clave] = promptPorDefecto(clave);
  for (const r of rows) out[r.clave] = r.texto;
  return out;
}

export async function setPrompt(clave: string, texto: string, userId: string) {
  await ensureGeneracionContenidoTables();
  await pool.query(
    `INSERT INTO gcc_world.gcont_prompts (clave, texto, updated_at, updated_by)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (clave) DO UPDATE SET texto = EXCLUDED.texto, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
    [clave, texto, userId],
  );
}

/* ── Referencia histórica: el buscador ────────────────────────────────────────── */
/**
 * Busca entre los PRODUCTOS, PROYECTOS y TICKETS del usuario (el admin busca en todos).
 *
 * Cada uno llega a su dueño por un camino distinto, y esto no se puede simplificar:
 *  · proyecto → `assigned_member_id`, o invitado en `project_members` / `project_bids`
 *  · ticket   → `member_id` (el responsable) o `user_id` (quien lo abrió)
 *  · producto → NO declara miembro: cuelga de `member_portfolio_items` y es el ítem del
 *               portafolio el que declara dueño (misma cadena que usa `lib/soluciones.ts`)
 */
export async function buscarReferencias(
  userId: string, memberId: number | null, isAdmin: boolean, q: string, tipo?: ReferenciaTipo | 'todos',
) {
  const like = `%${(q || '').trim()}%`;
  const quiere = (t: ReferenciaTipo) => !tipo || tipo === 'todos' || tipo === t;
  const out: { tipo: ReferenciaTipo; ref_id: number; titulo: string; subtitulo: string }[] = [];

  if (quiere('proyecto')) {
    const acceso = isAdmin
      ? ''
      : ` AND ($2::bigint IS NOT NULL AND (
            p.assigned_member_id = $2
            OR EXISTS (SELECT 1 FROM gcc_world.project_members pm WHERE pm.project_id = p.id AND pm.member_id = $2)
            OR EXISTS (SELECT 1 FROM gcc_world.project_bids pb WHERE pb.project_id = p.id AND pb.member_id = $2)
          ))`;
    const { rows } = await pool.query(
      `SELECT p.id, p.title, p.status, p.description
         FROM gcc_world.projects p
        WHERE (p.title ILIKE $1 OR p.description ILIKE $1)${acceso}
        ORDER BY p.created_at DESC LIMIT 25`,
      isAdmin ? [like] : [like, memberId],
    );
    for (const r of rows) out.push({ tipo: 'proyecto', ref_id: Number(r.id), titulo: r.title, subtitulo: r.status || '' });
  }

  if (quiere('ticket')) {
    const acceso = isAdmin ? '' : ` AND (t.member_id = $2 OR t.user_id::text = $3)`;
    const { rows } = await pool.query(
      `SELECT t.id, t.title, t.status, t.description
         FROM gcc_world.tickets t
        WHERE (t.title ILIKE $1 OR t.description ILIKE $1)${acceso}
        ORDER BY t.created_at DESC LIMIT 25`,
      isAdmin ? [like] : [like, memberId, userId],
    );
    for (const r of rows) out.push({ tipo: 'ticket', ref_id: Number(r.id), titulo: r.title, subtitulo: r.status || '' });
  }

  if (quiere('producto')) {
    const acceso = isAdmin ? '' : ` AND i.member_id = $2`;
    const { rows } = await pool.query(
      `SELECT pr.id, pr.name, pr.description, i.talent
         FROM gcc_world.products pr
         JOIN gcc_world.member_portfolio_items i ON i.id = pr.portfolio_item_id
        WHERE (pr.name ILIKE $1 OR pr.description ILIKE $1)${acceso}
        ORDER BY pr.updated_at DESC NULLS LAST, pr.id DESC LIMIT 25`,
      isAdmin ? [like] : [like, memberId],
    );
    for (const r of rows) out.push({ tipo: 'producto', ref_id: Number(r.id), titulo: r.name, subtitulo: r.talent || '' });
  }

  return out;
}

/**
 * Lo que el agente lee de cada referencia: título, descripción y **lo que de verdad se hizo**
 * (requerimientos del proyecto, acciones del ticket). Decisión de Fernando el 2026-09-06:
 * sin eso el guion habla del trabajo en abstracto. NO se incluyen nombres de cliente ni
 * importes: esto acaba dentro de un guion público.
 */
export async function detalleReferencias(refs: { tipo: string; ref_id: number }[]) {
  const out: string[] = [];
  for (const r of refs) {
    if (r.tipo === 'proyecto') {
      const { rows: [p] } = await pool.query(
        `SELECT title, description, status FROM gcc_world.projects WHERE id = $1`, [r.ref_id]);
      if (!p) continue;
      const { rows: reqs } = await pool.query(
        `SELECT title, description FROM gcc_world.project_requirements WHERE project_id = $1 ORDER BY id LIMIT 30`,
        [r.ref_id]);
      out.push(
        `PROYECTO «${p.title}» (${p.status})\n${p.description || 'Sin descripción.'}\n` +
        (reqs.length ? `Lo que incluyó:\n${reqs.map((x: any) => `  - ${x.title}${x.description ? `: ${x.description}` : ''}`).join('\n')}` : ''),
      );
    } else if (r.tipo === 'ticket') {
      const { rows: [t] } = await pool.query(
        `SELECT title, description, status FROM gcc_world.tickets WHERE id = $1`, [r.ref_id]);
      if (!t) continue;
      const { rows: acciones } = await pool.query(
        `SELECT description FROM gcc_world.ticket_actions WHERE ticket_id = $1 ORDER BY id LIMIT 30`, [r.ref_id]);
      out.push(
        `TICKET «${t.title}» (${t.status})\n${t.description || 'Sin descripción.'}\n` +
        (acciones.length ? `Acciones registradas:\n${acciones.map((x: any) => `  - ${x.description}`).join('\n')}` : ''),
      );
    } else if (r.tipo === 'producto') {
      const { rows: [p] } = await pool.query(
        `SELECT pr.name, pr.description, pr.category, i.title AS item_titulo, i.description AS item_desc, i.talent
           FROM gcc_world.products pr
           LEFT JOIN gcc_world.member_portfolio_items i ON i.id = pr.portfolio_item_id
          WHERE pr.id = $1`, [r.ref_id]);
      if (!p) continue;
      out.push(
        `PRODUCTO «${p.name}»${p.talent ? ` (talento: ${p.talent})` : ''}\n${p.description || p.item_desc || 'Sin descripción.'}`,
      );
    }
  }
  return out;
}

/* ── Fuentes de conocimiento: lectura de Gestión de Datos ─────────────────────── */
/**
 * Las seis tablas que Fernando quiere poder elegir, en formato tabla y SOLO LECTURA. Se leen
 * con consultas propias en lugar de reusar los `list*` de `gestion-datos-db` a propósito:
 * allí cada listado arrastra sus uniones de edición (unidades, variables, hipótesis…) y aquí
 * solo hace falta la etiqueta y el texto. Lo que NO se hace es escribir: este sistema no
 * toca la investigación de nadie.
 */
export async function listFuentesDisponibles(problematicaId: number) {
  const { rows: [prob] } = await pool.query(
    `SELECT id, name, ref FROM gcc_world.gd_problematicas WHERE id = $1`, [problematicaId]);
  if (!prob) return null;

  const [codigos, categorias, piezas, rompecabezas, subtemas, temas] = await Promise.all([
    pool.query(
      `SELECT c.id, c.texto, c.verificado,
              'COD-' || $2 || '-' || COALESCE(string_agg(
                 CASE WHEN u.unidad_kind = 'premisa' THEN f.seq::text
                      ELSE e.ganadora_seq || '.' || e.perdedora_seq END, '/' ORDER BY u.id), '') AS nomenclatura
         FROM gcc_world.gd_codigos c
         LEFT JOIN gcc_world.gd_codigo_unidades u ON u.codigo_id = c.id
         LEFT JOIN gcc_world.gd_fuentes f ON f.id = u.fuente_id
         LEFT JOIN (SELECT en.id, gf.seq AS ganadora_seq, pf.seq AS perdedora_seq
                      FROM gcc_world.gd_enfrentamientos en
                      JOIN gcc_world.gd_fuentes gf ON gf.id = en.ganadora_fuente_id
                      JOIN gcc_world.gd_fuentes pf ON pf.id = en.perdedora_fuente_id) e
                ON e.id = u.enfrentamiento_id
        WHERE c.problematica_id = $1
        GROUP BY c.id, c.texto, c.verificado
        ORDER BY c.id`,
      [problematicaId, prob.ref]),
    pool.query(
      `SELECT ca.id, ca.seq, ca.nombre, COUNT(cc.codigo_id)::int AS codigos
         FROM gcc_world.gd_categorias ca
         LEFT JOIN gcc_world.gd_categoria_codigos cc ON cc.categoria_id = ca.id
        WHERE ca.problematica_id = $1 GROUP BY ca.id ORDER BY ca.seq`, [problematicaId]),
    pool.query(
      `SELECT p.id, p.tipo, p.estado, COUNT(v.id)::int AS variables
         FROM gcc_world.gd_piezas p
         LEFT JOIN gcc_world.gd_pieza_variables v ON v.pieza_id = p.id
        WHERE p.problematica_id = $1 GROUP BY p.id ORDER BY p.id`, [problematicaId]),
    pool.query(
      `SELECT r.id, r.nombre, s.nombre AS situacion, COUNT(rp.pieza_id)::int AS piezas
         FROM gcc_world.gd_rompecabezas r
         LEFT JOIN gcc_world.gd_situaciones s ON s.id = r.situacion_id
         LEFT JOIN gcc_world.gd_rompecabezas_piezas rp ON rp.rompecabezas_id = r.id
        WHERE r.problematica_id = $1 GROUP BY r.id, s.nombre ORDER BY r.id`, [problematicaId]),
    pool.query(
      `SELECT s.id, s.titulo, COUNT(DISTINCT h.id)::int AS hipotesis, COUNT(DISTINCT sr.rompecabezas_id)::int AS rompecabezas
         FROM gcc_world.gd_subtemas s
         LEFT JOIN gcc_world.gd_subtema_hipotesis h ON h.subtema_id = s.id
         LEFT JOIN gcc_world.gd_subtema_rompecabezas sr ON sr.subtema_id = s.id
        WHERE s.problematica_id = $1 GROUP BY s.id ORDER BY s.id`, [problematicaId]),
    pool.query(
      `SELECT t.id, t.titulo, t.prosa, COUNT(ts.subtema_id)::int AS subtemas
         FROM gcc_world.gd_temas t
         LEFT JOIN gcc_world.gd_tema_subtemas ts ON ts.tema_id = t.id
        WHERE t.problematica_id = $1 GROUP BY t.id ORDER BY t.id`, [problematicaId]),
  ]);

  return {
    problematica: prob,
    codigo: codigos.rows.map((r: any) => ({
      id: Number(r.id), etiqueta: r.nomenclatura, texto: r.texto, extra: r.verificado ? 'Verificado' : 'Sin verificar',
    })),
    categoria: categorias.rows.map((r: any) => ({
      id: Number(r.id), etiqueta: `CAT-${r.seq}`, texto: r.nombre, extra: `${r.codigos} código(s)`,
    })),
    pieza: piezas.rows.map((r: any) => ({
      id: Number(r.id), etiqueta: r.tipo === 'revision' ? `PIE.REV-${r.id}` : `PIE.COR-${r.id}`,
      texto: r.tipo === 'revision' ? 'Revisión' : 'Corrección', extra: `${r.variables} variable(s) · ${r.estado}`,
    })),
    rompecabezas: rompecabezas.rows.map((r: any) => ({
      id: Number(r.id), etiqueta: r.nombre, texto: r.situacion || 'Sin situación', extra: `${r.piezas} pieza(s)`,
    })),
    subtema: subtemas.rows.map((r: any) => ({
      id: Number(r.id), etiqueta: r.titulo, texto: `${r.hipotesis} hipótesis`, extra: `${r.rompecabezas} rompecabezas`,
    })),
    tema: temas.rows.map((r: any) => ({
      id: Number(r.id), etiqueta: r.titulo, texto: (r.prosa || '').slice(0, 240), extra: `${r.subtemas} subtema(s)`,
    })),
  };
}

/** El texto de las fuentes elegidas, tal como lo lee el agente. */
export async function detalleFuentes(fuentes: { tipo: string; ref_id: number; etiqueta?: string }[]) {
  const out: string[] = [];
  for (const f of fuentes) {
    const et = f.etiqueta ? `${f.etiqueta} — ` : '';
    if (f.tipo === 'codigo') {
      const { rows: [c] } = await pool.query(
        `SELECT texto, verificado FROM gcc_world.gd_codigos WHERE id = $1`, [f.ref_id]);
      if (c) out.push(`CÓDIGO ${et}${c.texto}${c.verificado ? ' [verificado]' : ''}`);
    } else if (f.tipo === 'categoria') {
      const { rows: [c] } = await pool.query(
        `SELECT nombre FROM gcc_world.gd_categorias WHERE id = $1`, [f.ref_id]);
      if (c) out.push(`CATEGORÍA ${et}${c.nombre}`);
    } else if (f.tipo === 'pieza') {
      const { rows: [p] } = await pool.query(
        `SELECT tipo FROM gcc_world.gd_piezas WHERE id = $1`, [f.ref_id]);
      if (!p) continue;
      const { rows: vars } = await pool.query(
        `SELECT factor, nombre, tipo_var FROM gcc_world.gd_pieza_variables WHERE pieza_id = $1 ORDER BY id`, [f.ref_id]);
      out.push(`PIEZA ${et}${p.tipo}\n${vars.map((v: any) => `  - [${v.factor}/${v.tipo_var}] ${v.nombre}`).join('\n')}`);
    } else if (f.tipo === 'rompecabezas') {
      const { rows: [r] } = await pool.query(
        `SELECT r.nombre, s.nombre AS situacion FROM gcc_world.gd_rompecabezas r
           LEFT JOIN gcc_world.gd_situaciones s ON s.id = r.situacion_id WHERE r.id = $1`, [f.ref_id]);
      if (r) out.push(`ROMPECABEZAS ${et}${r.nombre}${r.situacion ? ` (situación: ${r.situacion})` : ''}`);
    } else if (f.tipo === 'subtema') {
      const { rows: [s] } = await pool.query(
        `SELECT titulo FROM gcc_world.gd_subtemas WHERE id = $1`, [f.ref_id]);
      if (!s) continue;
      const { rows: hip } = await pool.query(
        `SELECT texto FROM gcc_world.gd_subtema_hipotesis WHERE subtema_id = $1 ORDER BY orden`, [f.ref_id]);
      out.push(`SUBTEMA ${et}${s.titulo}\n${hip.map((h: any) => `  - ${h.texto}`).join('\n')}`);
    } else if (f.tipo === 'tema') {
      const { rows: [t] } = await pool.query(
        `SELECT titulo, prosa FROM gcc_world.gd_temas WHERE id = $1`, [f.ref_id]);
      if (t) out.push(`TEMA ${et}${t.titulo}\n${t.prosa}`);
    }
  }
  return out;
}

/** Las problemáticas, para el selector del panel de fuentes (solo lectura). */
export async function listProblematicasParaFuentes() {
  const { rows } = await pool.query(
    `SELECT id, name, ref FROM gcc_world.gd_problematicas ORDER BY name`);
  return rows;
}
