import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Convierte un MIEMBRO en CANDIDATO (solo admin). El usuario pasa a rol 'client' con
 * cuenta de candidato. Un **admin NO** puede degradarse a candidato.
 *
 * - Baja el usuario: `role='member' → 'client'`, `member_id = NULL` (pierde funciones
 *   de miembro). Nunca toca a un admin.
 * - Desactiva la fila `members` (se conserva por integridad/histórico; sale de la lista).
 * - Garantiza una fila `clients` con `account_type='candidate'` (aprobada + perfil
 *   completo) enlazada al usuario, para que aparezca en la lista de Candidatos.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await pool.connect();
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const { id } = await params; // member id

    const { rows: [member] } = await client.query(
      `SELECT id, name, email, phone FROM gcc_world.members WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (!member) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 });

    const { rows: [u] } = await client.query(
      `SELECT id, email, first_name, last_name, role, password_hash
         FROM gcc_world.users WHERE member_id::bigint = $1 LIMIT 1`,
      [id],
    );
    if (!u) return NextResponse.json({ error: 'Este miembro no tiene una cuenta de usuario para convertir.' }, { status: 400 });
    if (u.role === 'admin') {
      return NextResponse.json({ error: 'No se puede cambiar el rol de un administrador a candidato.' }, { status: 400 });
    }

    const email = String(u.email || member.email || '').trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'El miembro no tiene correo.' }, { status: 400 });
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || member.name || email;

    await client.query('BEGIN');

    // Garantiza fila de candidato en clients (por user_id o por email), enlazada al usuario.
    const { rows: [existingClient] } = await client.query(
      `SELECT id FROM gcc_world.clients WHERE user_id = $1 OR LOWER(email) = $2 LIMIT 1`,
      [u.id, email],
    );
    if (existingClient) {
      await client.query(
        `UPDATE gcc_world.clients
            SET account_type = 'candidate', approved = true, profile_completed = true,
                email_verified = true, user_id = $1
          WHERE id = $2`,
        [u.id, existingClient.id],
      );
    } else {
      await client.query(
        `INSERT INTO gcc_world.clients
            (name, full_name, email, alias, account_type, approved, profile_completed,
             email_verified, password_hash, phone, client_token, user_id, last_seen_at)
         VALUES ($1, $1, $2, 'Candidato', 'candidate', true, true, true, $3, $4, $5, $6, NOW())`,
        [name, email, u.password_hash || null, member.phone || null, randomBytes(24).toString('hex'), u.id],
      );
    }

    // Baja el usuario a candidato (rol client, sin miembro) y desactiva la fila de miembro.
    await client.query(`UPDATE gcc_world.users SET role = 'client', member_id = NULL WHERE id = $1`, [u.id]);
    await client.query(`UPDATE gcc_world.members SET is_active = false WHERE id = $1`, [id]);

    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Member to candidate error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
