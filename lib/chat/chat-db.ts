import { pool } from '@/lib/db';

/**
 * CHAT de la aplicación.
 *
 * Hoy existe UNA sola conversación: el **chat grupal abierto** (`kind='group'`), no asociado a
 * ningún ticket, proyecto, experiencia ni reunión. No hay chats individuales persona a persona.
 *
 * El modelo YA contempla los chats temporales que vendrán (desde Tickets, Proyectos y
 * Experiencias): son conversaciones con `kind` + `ref_id` y una **retención en días**. El
 * trabajo nocturno borra los mensajes que superan esa retención. El grupal tiene
 * `retention_days = NULL` → permanente.
 *
 * GOTCHA resuelto: `ref_id` es **NOT NULL DEFAULT ''** y no NULL. En Postgres los NULL se
 * consideran distintos entre sí dentro de un índice único, así que con `ref_id NULL` el
 * `UNIQUE (kind, ref_id)` NO habría impedido crear varios chats grupales (verificado contra la
 * BD: dos INSERT idénticos pasaban). Con '' el unique sí protege.
 */

export const GROUP_KIND = 'group';
/** Retención por defecto de los chats temporales (tickets/proyectos/experiencias). */
export const TEMP_RETENTION_DAYS = 30;

/* ── DDL (promise-singleton, patrón obligatorio de la casa) ──────────────────── */
let ready = false;
let ensuring: Promise<void> | null = null;

export async function ensureChatTables(): Promise<void> {
  if (ready) return;
  if (ensuring) return ensuring;
  ensuring = doEnsure().then(() => { ready = true; }).finally(() => { ensuring = null; });
  return ensuring;
}

async function doEnsure(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.ch_conversations (
      id BIGSERIAL PRIMARY KEY,
      kind TEXT NOT NULL,                          -- 'group' | 'ticket' | 'project' | 'experience' | 'meeting'
      ref_id TEXT NOT NULL DEFAULT '',             -- id del origen; '' en el grupal (ver GOTCHA arriba)
      title TEXT NOT NULL DEFAULT '',
      retention_days INT,                          -- NULL = permanente; 30 = temporal
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (kind, ref_id)
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.ch_messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id BIGINT NOT NULL REFERENCES gcc_world.ch_conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,                       -- users.id (uuid como texto)
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  // El sondeo incremental pide "mensajes con id > N de esta conversación": índice compuesto.
  await pool.query(`CREATE INDEX IF NOT EXISTS ch_messages_conv_id_idx ON gcc_world.ch_messages (conversation_id, id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ch_messages_created_idx ON gcc_world.ch_messages (created_at)`);

  // Marca de lectura por (conversación, usuario) → burbuja de no leídos.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.ch_reads (
      conversation_id BIGINT NOT NULL REFERENCES gcc_world.ch_conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      last_read_id BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (conversation_id, user_id)
    )`);

  // PRESENCIA: última vez que se vio activo a cada usuario dentro de la app.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.ch_presence (
      user_id TEXT PRIMARY KEY,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  // Siembra idempotente del chat grupal (permanente: retention_days NULL).
  await pool.query(
    `INSERT INTO gcc_world.ch_conversations (kind, ref_id, title, retention_days)
     VALUES ($1, '', 'Chat general', NULL)
     ON CONFLICT (kind, ref_id) DO NOTHING`,
    [GROUP_KIND],
  );
}

/* ── Tipos ───────────────────────────────────────────────────────────────────── */

export interface ChatMessage {
  id: number;
  userId: string;
  authorName: string;
  authorAvatar: string | null;
  authorRole: string;
  body: string;
  createdAt: string;
}

export interface Conversation {
  id: number;
  kind: string;
  refId: string;
  title: string;
  retentionDays: number | null;
}

const mapMessage = (r: any): ChatMessage => ({
  id: Number(r.id),
  userId: String(r.user_id),
  // Nombre + apellido; si faltan, cae al email (mismo criterio que /api/auth/me).
  authorName: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.email || 'Usuario',
  authorAvatar: r.avatar_url ?? null,
  authorRole: r.role || '',
  body: r.body,
  createdAt: new Date(r.created_at).toISOString(),
});

/* ── Conversaciones ──────────────────────────────────────────────────────────── */

/** La conversación grupal (única). La crea `ensureChatTables` si no existe. */
export async function getGroupConversation(): Promise<Conversation> {
  await ensureChatTables();
  const { rows } = await pool.query(
    `SELECT id, kind, ref_id, title, retention_days FROM gcc_world.ch_conversations
      WHERE kind = $1 AND ref_id = ''`,
    [GROUP_KIND],
  );
  const r = rows[0];
  return { id: Number(r.id), kind: r.kind, refId: r.ref_id, title: r.title, retentionDays: r.retention_days ?? null };
}

/**
 * Conversación temporal de un origen (ticket/proyecto/experiencia/reunión), creándola si hace
 * falta. Aún no se usa desde la UI — queda lista para el desarrollo futuro, y es la que el
 * trabajo nocturno purga por `retention_days`.
 */
export async function getOrCreateScopedConversation(
  kind: string, refId: string, title = '', retentionDays: number = TEMP_RETENTION_DAYS,
): Promise<Conversation> {
  await ensureChatTables();
  if (kind === GROUP_KIND) throw new Error('El chat grupal no lleva origen.');
  await pool.query(
    `INSERT INTO gcc_world.ch_conversations (kind, ref_id, title, retention_days)
     VALUES ($1, $2, $3, $4) ON CONFLICT (kind, ref_id) DO NOTHING`,
    [kind, refId, title, retentionDays],
  );
  const { rows } = await pool.query(
    `SELECT id, kind, ref_id, title, retention_days FROM gcc_world.ch_conversations WHERE kind = $1 AND ref_id = $2`,
    [kind, refId],
  );
  const r = rows[0];
  return { id: Number(r.id), kind: r.kind, refId: r.ref_id, title: r.title, retentionDays: r.retention_days ?? null };
}

/**
 * Asegura de una vez las conversaciones de varios orígenes y devuelve `kind:refId` → id.
 * Evita el N+1 de llamar a `getOrCreateScopedConversation` por cada chat de la lista.
 */
export async function ensureScopedConversations(
  scopes: { kind: string; refId: string; title?: string }[],
): Promise<Map<string, number>> {
  await ensureChatTables();
  const out = new Map<string, number>();
  if (scopes.length === 0) return out;

  const kinds = scopes.map((s) => s.kind);
  const refs = scopes.map((s) => s.refId);
  const titles = scopes.map((s) => s.title ?? '');
  await pool.query(
    `INSERT INTO gcc_world.ch_conversations (kind, ref_id, title, retention_days)
     SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[]) AS t(kind, ref_id, title),
                  LATERAL (SELECT $4::int) AS r(retention_days)
     ON CONFLICT (kind, ref_id) DO NOTHING`,
    [kinds, refs, titles, TEMP_RETENTION_DAYS],
  );
  const { rows } = await pool.query(
    `SELECT id, kind, ref_id FROM gcc_world.ch_conversations
      WHERE (kind, ref_id) IN (SELECT * FROM UNNEST($1::text[], $2::text[]))`,
    [kinds, refs],
  );
  for (const r of rows) out.set(`${r.kind}:${r.ref_id}`, Number(r.id));
  return out;
}

/** No leídos y último mensaje de varias conversaciones a la vez. */
export async function summarizeConversations(
  conversationIds: number[], userId: string,
): Promise<Record<number, { unread: number; lastAt: string | null; lastBody: string | null }>> {
  await ensureChatTables();
  const out: Record<number, { unread: number; lastAt: string | null; lastBody: string | null }> = {};
  if (conversationIds.length === 0) return out;
  const { rows } = await pool.query(
    `SELECT c.id,
            COALESCE(un.n, 0)::int AS unread,
            last.created_at AS last_at,
            last.body AS last_body
       FROM gcc_world.ch_conversations c
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS n FROM gcc_world.ch_messages m
          WHERE m.conversation_id = c.id AND m.user_id <> $2
            AND m.id > COALESCE((SELECT last_read_id FROM gcc_world.ch_reads
                                  WHERE conversation_id = c.id AND user_id = $2), 0)
       ) un ON TRUE
       LEFT JOIN LATERAL (
         SELECT m.created_at, m.body FROM gcc_world.ch_messages m
          WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1
       ) last ON TRUE
      WHERE c.id = ANY($1::bigint[])`,
    [conversationIds, userId],
  );
  for (const r of rows) {
    out[Number(r.id)] = {
      unread: Number(r.unread),
      lastAt: r.last_at ? new Date(r.last_at).toISOString() : null,
      lastBody: r.last_body ?? null,
    };
  }
  return out;
}

/* ── Mensajes ────────────────────────────────────────────────────────────────── */

/**
 * Mensajes de una conversación, del más antiguo al más nuevo.
 *  - `after`  → solo los posteriores a ese id (sondeo incremental; barato).
 *  - `before` → los anteriores a ese id (cargar historial hacia atrás).
 * Sin ninguno de los dos devuelve los `limit` más recientes.
 */
export async function listMessages(
  conversationId: number, opts: { after?: number; before?: number; limit?: number } = {},
): Promise<ChatMessage[]> {
  await ensureChatTables();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const params: any[] = [conversationId];
  let rows: any[];

  if (opts.after != null) {
    params.push(opts.after, limit);
    rows = (await pool.query(
      `SELECT m.id, m.user_id, m.body, m.created_at, u.first_name, u.last_name, u.avatar_url, u.role, u.email
         FROM gcc_world.ch_messages m
         LEFT JOIN gcc_world.users u ON u.id::text = m.user_id
        WHERE m.conversation_id = $1 AND m.id > $2
        ORDER BY m.id ASC LIMIT $3`, params)).rows;
  } else {
    // Los más recientes (o los anteriores a `before`); se invierten para devolverlos en orden.
    let where = '';
    if (opts.before != null) { params.push(opts.before); where = `AND m.id < $${params.length}`; }
    params.push(limit);
    rows = (await pool.query(
      `SELECT m.id, m.user_id, m.body, m.created_at, u.first_name, u.last_name, u.avatar_url, u.role, u.email
         FROM gcc_world.ch_messages m
         LEFT JOIN gcc_world.users u ON u.id::text = m.user_id
        WHERE m.conversation_id = $1 ${where}
        ORDER BY m.id DESC LIMIT $${params.length}`, params)).rows;
    rows.reverse();
  }
  return rows.map(mapMessage);
}

export async function postMessage(conversationId: number, userId: string, body: string): Promise<ChatMessage> {
  await ensureChatTables();
  const text = body.trim();
  const { rows } = await pool.query(
    `WITH ins AS (
       INSERT INTO gcc_world.ch_messages (conversation_id, user_id, body)
       VALUES ($1, $2, $3) RETURNING id, user_id, body, created_at
     )
     SELECT ins.*, u.first_name, u.last_name, u.avatar_url, u.role, u.email
       FROM ins LEFT JOIN gcc_world.users u ON u.id::text = ins.user_id`,
    [conversationId, userId, text],
  );
  return mapMessage(rows[0]);
}

/** Nº de mensajes de OTROS posteriores a la última lectura del usuario. */
export async function getUnreadCount(conversationId: number, userId: string): Promise<number> {
  await ensureChatTables();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM gcc_world.ch_messages m
      WHERE m.conversation_id = $1
        AND m.user_id <> $2
        AND m.id > COALESCE((SELECT last_read_id FROM gcc_world.ch_reads
                              WHERE conversation_id = $1 AND user_id = $2), 0)`,
    [conversationId, userId],
  );
  return Number(rows[0].n);
}

/** Marca leído hasta `lastId`. Nunca retrocede (GREATEST) para no “desleer” por una carrera. */
export async function markRead(conversationId: number, userId: string, lastId: number): Promise<void> {
  await ensureChatTables();
  await pool.query(
    `INSERT INTO gcc_world.ch_reads (conversation_id, user_id, last_read_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (conversation_id, user_id)
     DO UPDATE SET last_read_id = GREATEST(gcc_world.ch_reads.last_read_id, EXCLUDED.last_read_id),
                   updated_at = NOW()`,
    [conversationId, userId, lastId],
  );
}

/* ── Presencia ───────────────────────────────────────────────────────────────
 * "Estado de conexión en la app". No hace falta un canal aparte: el chat ya sondea
 * (4 s abierto / 30 s cerrado), así que ese mismo sondeo actúa de LATIDO y la presencia
 * sale gratis. Consecuencia honesta: solo refleja a quien tiene el dashboard abierto —
 * que es exactamente lo que significa "conectado en la app".
 */

/** Umbral para considerar a alguien EN LÍNEA. Holgado sobre el sondeo de 30 s del panel cerrado. */
export const ONLINE_SECONDS = 90;

export async function touchPresence(userId: string): Promise<void> {
  await ensureChatTables();
  await pool.query(
    `INSERT INTO gcc_world.ch_presence (user_id, last_seen_at) VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET last_seen_at = NOW()`,
    [userId],
  );
}

export interface Participant {
  userId: string;
  name: string;
  avatar: string | null;
  role: string;
  /** Papel dentro de ESTE chat (cliente, responsable, participante…). */
  relation: string;
  online: boolean;
  lastSeenAt: string | null;
}

/** Resuelve nombre, avatar y presencia de un conjunto de usuarios. */
export async function describeUsers(userIds: string[], relations: Record<string, string> = {}): Promise<Participant[]> {
  await ensureChatTables();
  if (userIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_url, u.role,
            p.last_seen_at,
            (p.last_seen_at IS NOT NULL AND p.last_seen_at > NOW() - ($2 || ' seconds')::interval) AS online
       FROM gcc_world.users u
       LEFT JOIN gcc_world.ch_presence p ON p.user_id = u.id::text
      WHERE u.id::text = ANY($1::text[])`,
    [userIds, String(ONLINE_SECONDS)],
  );
  const list: Participant[] = rows.map((r: any) => ({
    userId: String(r.id),
    name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.email || 'Usuario',
    avatar: r.avatar_url ?? null,
    role: r.role || '',
    relation: relations[String(r.id)] || '',
    online: !!r.online,
    lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null,
  }));
  // Primero los conectados, y dentro de cada grupo por nombre.
  return list.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'es'));
}

/* ── Retención (trabajo nocturno) ────────────────────────────────────────────── */

/**
 * Borra los mensajes que superan la retención de SU conversación. Solo afecta a las que
 * tienen `retention_days` (los chats temporales de ticket/proyecto/experiencia); el chat
 * grupal, con `retention_days = NULL`, nunca se purga.
 * Idempotente: volver a ejecutarlo no borra nada nuevo.
 */
export async function purgeExpiredMessages(): Promise<{ deleted: number }> {
  await ensureChatTables();
  const { rowCount } = await pool.query(
    `DELETE FROM gcc_world.ch_messages m
      USING gcc_world.ch_conversations c
      WHERE m.conversation_id = c.id
        AND c.retention_days IS NOT NULL
        AND m.created_at < NOW() - (c.retention_days || ' days')::interval`,
  );
  return { deleted: rowCount || 0 };
}
