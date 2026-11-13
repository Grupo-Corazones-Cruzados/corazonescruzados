import { pool } from '@/lib/db';
import { createNotification } from '@/lib/notifications';

/**
 * DENUNCIAR Y BLOQUEAR (Fernando, 2026-11-13; Apple, normas 2.1 y 1.2). Tablas en `sql/migrations/091_moderacion.sql`.
 *
 * - Cualquiera con sesión denuncia una publicación del Marketplace o un mensaje de chat; a los administradores les
 *   llega el aviso y la resuelven en Admin ▸ Denuncias (retirar el contenido o descartar).
 * - Cualquiera bloquea a otra persona: deja de ver sus publicaciones del Marketplace y sus mensajes. Es personal; la
 *   otra persona no se entera. Se deshace en Configuración ▸ Perfil ▸ Personas bloqueadas.
 */

export type TipoDenuncia = 'portafolio' | 'proyecto' | 'mensaje';
export type MotivoDenuncia = 'ofensivo' | 'acoso' | 'engano' | 'spam' | 'otro';

export const MOTIVOS: { value: MotivoDenuncia; label: string }[] = [
  { value: 'ofensivo', label: 'Contenido ofensivo o inapropiado' },
  { value: 'acoso', label: 'Acoso o amenazas' },
  { value: 'engano', label: 'Engaño o fraude' },
  { value: 'spam', label: 'Spam o publicidad' },
  { value: 'otro', label: 'Otro motivo' },
];
const ES_MOTIVO = new Set(MOTIVOS.map((m) => m.value));
const ES_TIPO = new Set<TipoDenuncia>(['portafolio', 'proyecto', 'mensaje']);

/** Lo bloqueado por una cuenta: por cuenta (chat) y por ficha de miembro (Marketplace). */
export async function bloqueosDe(usuarioId: string) {
  const { rows } = await pool.query(
    `SELECT b.id, b.nombre, b.creado_en, b.bloqueado_user_id::text AS user_id,
            COALESCE(b.bloqueado_member_id, u.member_id) AS member_id
       FROM gcc_world.moderacion_bloqueos b
       LEFT JOIN gcc_world.users u ON u.id = b.bloqueado_user_id
      WHERE b.usuario_id = $1::uuid
      ORDER BY b.creado_en DESC`,
    [usuarioId],
  );
  return {
    lista: rows.map((r: any) => ({ id: Number(r.id), nombre: r.nombre || 'Persona', creado_en: r.creado_en })),
    userIds: rows.map((r: any) => r.user_id).filter(Boolean) as string[],
    memberIds: rows.map((r: any) => r.member_id).filter((x: any) => x != null).map(Number),
  };
}

/** Bloquea por cuenta o por ficha de miembro; completa el otro lado si existe. */
export async function bloquear(usuarioId: string, objetivo: { userId?: string; memberId?: number }) {
  let userId = objetivo.userId || null;
  let memberId = objetivo.memberId ?? null;
  let nombre: string | null = null;
  if (userId) {
    const { rows } = await pool.query(
      `SELECT u.member_id, NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS nombre, m.name AS ficha
         FROM gcc_world.users u LEFT JOIN gcc_world.members m ON m.id = u.member_id WHERE u.id = $1::uuid`, [userId]);
    if (!rows[0]) throw new Error('Esa cuenta no existe');
    memberId = memberId ?? (rows[0].member_id != null ? Number(rows[0].member_id) : null);
    nombre = rows[0].nombre || rows[0].ficha;
  } else if (memberId != null) {
    const { rows } = await pool.query(
      `SELECT m.name, u.id::text AS user_id FROM gcc_world.members m
         LEFT JOIN gcc_world.users u ON u.member_id = m.id WHERE m.id = $1 LIMIT 1`, [memberId]);
    if (!rows[0]) throw new Error('Esa persona no existe');
    userId = rows[0].user_id;
    nombre = rows[0].name;
  } else {
    throw new Error('Falta a quién bloquear');
  }
  if (userId === usuarioId) throw new Error('No puedes bloquearte a ti mismo');
  const ya = await pool.query(
    `SELECT 1 FROM gcc_world.moderacion_bloqueos WHERE usuario_id = $1::uuid
        AND (($2::uuid IS NOT NULL AND bloqueado_user_id = $2::uuid) OR ($3::bigint IS NOT NULL AND bloqueado_member_id = $3::bigint))`,
    [usuarioId, userId, memberId]);
  if (!ya.rows.length) {
    await pool.query(
      `INSERT INTO gcc_world.moderacion_bloqueos (usuario_id, bloqueado_user_id, bloqueado_member_id, nombre)
       VALUES ($1::uuid, $2::uuid, $3, $4)`,
      [usuarioId, userId, memberId, nombre]);
  }
  return { nombre: nombre || 'Persona' };
}

export async function desbloquear(usuarioId: string, id: number) {
  await pool.query(`DELETE FROM gcc_world.moderacion_bloqueos WHERE id = $1 AND usuario_id = $2::uuid`, [id, usuarioId]);
}

/** El contenido denunciado, para el extracto y para saber de quién es. `null` si no existe. */
async function contenidoDe(tipo: TipoDenuncia, objetoId: string): Promise<{ autorId: string | null; extracto: string } | null> {
  if (tipo === 'mensaje') {
    if (!/^\d+$/.test(objetoId)) return null;
    const { rows } = await pool.query(`SELECT user_id, body FROM gcc_world.ch_messages WHERE id = $1`, [objetoId]);
    return rows[0] ? { autorId: rows[0].user_id, extracto: String(rows[0].body).slice(0, 1000) } : null;
  }
  if (!/^\d+$/.test(objetoId)) return null;
  if (tipo === 'portafolio') {
    const { rows } = await pool.query(
      `SELECT pi.title, pi.description, u.id::text AS autor
         FROM gcc_world.member_portfolio_items pi LEFT JOIN gcc_world.users u ON u.member_id = pi.member_id
        WHERE pi.id = $1 LIMIT 1`, [objetoId]);
    return rows[0] ? { autorId: rows[0].autor, extracto: [rows[0].title, rows[0].description].filter(Boolean).join(' — ').slice(0, 1000) } : null;
  }
  const { rows } = await pool.query(`SELECT title, description FROM gcc_world.projects WHERE id = $1`, [objetoId]);
  return rows[0] ? { autorId: null, extracto: [rows[0].title, rows[0].description].filter(Boolean).join(' — ').slice(0, 1000) } : null;
}

export async function denunciar(denuncianteId: string, d: { tipo: string; objetoId: string; motivo: string; detalle?: string }) {
  if (!ES_TIPO.has(d.tipo as TipoDenuncia)) throw new Error('Tipo de denuncia no válido');
  if (!ES_MOTIVO.has(d.motivo as MotivoDenuncia)) throw new Error('Elige un motivo');
  const objetoId = String(d.objetoId || '');
  const c = await contenidoDe(d.tipo as TipoDenuncia, objetoId);
  if (!c) throw new Error('Ese contenido ya no existe');
  if (c.autorId && c.autorId === denuncianteId) throw new Error('No puedes denunciar tu propio contenido');
  const detalle = (d.detalle || '').trim().slice(0, 1000) || null;
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.moderacion_denuncias (denunciante_id, tipo, objeto_id, autor_id, motivo, detalle, extracto)
     VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6, $7)
     ON CONFLICT (denunciante_id, tipo, objeto_id) WHERE estado = 'pendiente' DO NOTHING
     RETURNING id`,
    [denuncianteId, d.tipo, objetoId, c.autorId, d.motivo, detalle, c.extracto]);
  if (!rows.length) return; // ya la había denunciado y sigue pendiente
  const admins = await pool.query(`SELECT id::text FROM gcc_world.users WHERE role = 'admin'`);
  const motivo = MOTIVOS.find((m) => m.value === d.motivo)?.label || d.motivo;
  await Promise.all(admins.rows.map((a: any) => createNotification(a.id, {
    type: 'moderacion',
    title: 'Nueva denuncia de contenido',
    message: `${motivo}: ${c.extracto.slice(0, 120)}`,
    link: '/dashboard/admin?tab=denuncias',
  }).catch(() => {})));
}

export async function listarDenuncias(estado: 'pendiente' | 'todas') {
  const { rows } = await pool.query(
    `SELECT d.id, d.tipo, d.objeto_id, d.motivo, d.detalle, d.extracto, d.estado, d.creada_en, d.resuelta_en,
            NULLIF(TRIM(CONCAT_WS(' ', den.first_name, den.last_name)), '') AS denunciante, den.email AS denunciante_correo,
            NULLIF(TRIM(CONCAT_WS(' ', au.first_name, au.last_name)), '') AS autor, au.email AS autor_correo
       FROM gcc_world.moderacion_denuncias d
       LEFT JOIN gcc_world.users den ON den.id = d.denunciante_id
       LEFT JOIN gcc_world.users au ON au.id = d.autor_id
      ${estado === 'pendiente' ? `WHERE d.estado = 'pendiente'` : ''}
      ORDER BY (d.estado = 'pendiente') DESC, d.creada_en DESC
      LIMIT 300`);
  return rows;
}

/**
 * Resolver: `retirar` quita el contenido (ficha oculta del Marketplace, proyecto despublicado, mensaje borrado) y
 * cierra TODAS las denuncias pendientes sobre él; `descartar` cierra solo esta.
 */
export async function resolverDenuncia(id: number, accion: 'retirar' | 'descartar', adminId: string) {
  const { rows } = await pool.query(`SELECT tipo, objeto_id FROM gcc_world.moderacion_denuncias WHERE id = $1`, [id]);
  const d = rows[0];
  if (!d) throw new Error('La denuncia no existe');
  if (accion === 'descartar') {
    await pool.query(
      `UPDATE gcc_world.moderacion_denuncias SET estado = 'descartada', resuelta_por = $2::uuid, resuelta_en = NOW()
        WHERE id = $1`, [id, adminId]);
    return;
  }
  if (d.tipo === 'mensaje') await pool.query(`DELETE FROM gcc_world.ch_messages WHERE id = $1`, [d.objeto_id]);
  else if (d.tipo === 'portafolio') await pool.query(`UPDATE gcc_world.member_portfolio_items SET retirado_moderacion_en = NOW() WHERE id = $1`, [d.objeto_id]);
  else await pool.query(`UPDATE gcc_world.projects SET is_marketplace_published = false WHERE id = $1`, [d.objeto_id]);
  await pool.query(
    `UPDATE gcc_world.moderacion_denuncias SET estado = 'retirado', resuelta_por = $3::uuid, resuelta_en = NOW()
      WHERE (id = $1 OR (tipo = $2 AND objeto_id = $4 AND estado = 'pendiente'))`,
    [id, d.tipo, adminId, d.objeto_id]);
}
