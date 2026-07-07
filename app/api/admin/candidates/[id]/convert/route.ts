import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

/**
 * Convierte un CANDIDATO en MIEMBRO (solo admin).
 *
 * - Crea (o reutiliza por email) una fila en `gcc_world.members` activa.
 * - Da acceso de dashboard como miembro: si el candidato ya tiene usuario enlazado
 *   (`clients.user_id`) lo promueve a `role='member'`; si no, crea un `users` con las
 *   mismas credenciales del candidato (reusa su `password_hash`) para que entre con
 *   su contraseña actual. Enlaza `users.member_id` y `clients.user_id`.
 * - Nunca degrada a un admin (mantiene su rol).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await pool.connect();
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const { id } = await params;

    const { rows: [cand] } = await client.query(
      `SELECT id, name, full_name, email, phone, password_hash, user_id, account_type
         FROM gcc_world.clients WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (!cand || cand.account_type !== 'candidate') {
      return NextResponse.json({ error: 'Candidato no encontrado' }, { status: 404 });
    }
    const email = String(cand.email || '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'El candidato no tiene correo; no se puede crear su acceso de miembro.' }, { status: 400 });
    }
    const name = String(cand.full_name || cand.name || email).trim();

    await client.query('BEGIN');

    // ── Usuario destino (existente por enlace o por email) ──
    let userId: string | null = cand.user_id || null;
    if (!userId) {
      const { rows: [u] } = await client.query(`SELECT id FROM gcc_world.users WHERE LOWER(email) = $1 LIMIT 1`, [email]);
      userId = u?.id || null;
    }

    // ── Miembro: reusa por (usuario ya enlazado) o por email, o crea ──
    let memberId: number | null = null;
    if (userId) {
      const { rows: [u] } = await client.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
      memberId = u?.member_id ? Number(u.member_id) : null;
    }
    if (!memberId) {
      const { rows: [m] } = await client.query(`SELECT id FROM gcc_world.members WHERE LOWER(email) = $1 LIMIT 1`, [email]);
      if (m) memberId = Number(m.id);
    }
    if (!memberId) {
      const { rows: [m] } = await client.query(
        `INSERT INTO gcc_world.members (name, email, phone, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
        [name, email, cand.phone || null],
      );
      memberId = Number(m.id);
    } else {
      // Reactiva un miembro reusado (p. ej. uno degradado antes a candidato).
      await client.query(`UPDATE gcc_world.members SET is_active = true WHERE id = $1`, [memberId]);
    }

    // ── Usuario: promueve o crea ──
    if (userId) {
      await client.query(
        `UPDATE gcc_world.users
            SET role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'member' END,
                member_id = COALESCE(member_id, $1)
          WHERE id = $2`,
        [memberId, userId],
      );
    } else {
      if (!cand.password_hash) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'El candidato aún no tiene contraseña definida (no completó su acceso).' }, { status: 400 });
      }
      const { rows: [nu] } = await client.query(
        `INSERT INTO gcc_world.users (email, password_hash, role, member_id, is_verified, first_name)
         VALUES ($1, $2, 'member', $3, true, $4) RETURNING id`,
        [email, cand.password_hash, memberId, name],
      );
      userId = nu.id;
    }

    // Enlaza la cuenta de candidato con el usuario miembro.
    await client.query(`UPDATE gcc_world.clients SET user_id = $1 WHERE id = $2`, [userId, cand.id]);

    await client.query('COMMIT');
    return NextResponse.json({ ok: true, member_id: memberId, user_id: userId });
  } catch (err: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Convert candidate error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
