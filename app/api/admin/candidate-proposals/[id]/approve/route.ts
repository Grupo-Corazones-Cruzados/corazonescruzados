import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { hashPassword } from '@/lib/auth/password';
import { generateClientToken } from '@/lib/world/session';
import { sendCandidateApprovalEmail } from '@/lib/integrations/resend';

function tempPassword(): string {
  // 10 caracteres legibles (sin 0/O/1/l).
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// POST — aprueba una postulación: crea la cuenta de candidato (contraseña
// temporal) en gcc_world.clients y le envía el correo de aprobación.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const { id } = await params;

    const pr = await pool.query(
      `SELECT id, email, ip_hash, status FROM gcc_world.candidate_proposals WHERE id = $1 LIMIT 1`,
      [id],
    );
    const proposal = pr.rows[0];
    if (!proposal) {
      return NextResponse.json({ error: 'Postulación no encontrada' }, { status: 404 });
    }
    if (proposal.status === 'approved') {
      return NextResponse.json({ error: 'Esta postulación ya fue aprobada' }, { status: 409 });
    }

    const cleanEmail = String(proposal.email).trim().toLowerCase();
    const temp = tempPassword();
    const passwordHash = await hashPassword(temp);
    const clientToken = generateClientToken();

    // Columnas de cuenta de candidato (idempotente).
    await pool.query(
      `ALTER TABLE gcc_world.clients
         ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'candidate',
         ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
         ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false`,
    );

    // Crea o actualiza la fila del candidato (sin personaje aún). Queda aprobada,
    // con correo verificado, contraseña temporal y profile_completed=false.
    const existing = await pool.query(
      `SELECT id FROM gcc_world.clients WHERE LOWER(email) = $1 LIMIT 1`,
      [cleanEmail],
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE gcc_world.clients
            SET password_hash = $1, email_verified = true, approved = true,
                account_type = 'candidate', profile_completed = false,
                client_token = $2, ip_hash = COALESCE($3, ip_hash)
          WHERE id = $4`,
        [passwordHash, clientToken, proposal.ip_hash, existing.rows[0].id],
      );
    } else {
      await pool.query(
        `INSERT INTO gcc_world.clients
            (name, email, alias, password_hash, email_verified, approved,
             account_type, profile_completed, client_token, ip_hash, last_seen_at)
         VALUES ($1, $1, 'Candidato', $2, true, true, 'candidate', false, $3, $4, NOW())`,
        [cleanEmail, passwordHash, clientToken, proposal.ip_hash],
      );
    }

    // Marca la postulación como aprobada.
    await pool.query(
      `UPDATE gcc_world.candidate_proposals
          SET status = 'approved', decided_at = NOW(), decided_by = $1
        WHERE id = $2`,
      [user.email ?? 'admin', proposal.id],
    );

    // Correo de aprobación con la contraseña temporal.
    try {
      await sendCandidateApprovalEmail(cleanEmail, temp);
    } catch (e) {
      console.error('Approval email failed:', e);
      return NextResponse.json(
        { ok: true, emailSent: false, error: 'Aprobado, pero no se pudo enviar el correo.' },
        { status: 200 },
      );
    }

    return NextResponse.json({ ok: true, emailSent: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Approve proposal error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
