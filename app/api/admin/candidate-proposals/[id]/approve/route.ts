import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { generateClientToken } from '@/lib/world/session';
import { sendCandidateApprovalEmail } from '@/lib/integrations/resend';

// POST — aprueba una postulación: deja la fila de candidato en gcc_world.clients
// APROBADA pero SIN contraseña (queda como una solicitud aprobada) y le envía el
// correo de aprobación. El candidato define su contraseña + datos al continuar su
// postulación (`complete-profile`); hasta entonces NO puede iniciar sesión (el login
// exige `password_hash`).
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
    const clientToken = generateClientToken();

    // Columnas de cuenta de candidato (idempotente).
    await pool.query(
      `ALTER TABLE gcc_world.clients
         ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'candidate',
         ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
         ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false`,
    );

    // Crea o actualiza la fila del candidato (sin personaje aún). Queda APROBADA, con
    // correo verificado, SIN contraseña (password_hash intacto/null) y profile_completed=false.
    // No se toca `password_hash`: si por algún caso ya tuviera una, se conserva; si es
    // fila nueva, queda NULL → el candidato no puede iniciar sesión hasta completar su cuenta.
    const existing = await pool.query(
      `SELECT id FROM gcc_world.clients WHERE LOWER(email) = $1 LIMIT 1`,
      [cleanEmail],
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE gcc_world.clients
            SET email_verified = true, approved = true,
                account_type = 'candidate', profile_completed = false,
                client_token = $1, ip_hash = COALESCE($2, ip_hash)
          WHERE id = $3`,
        [clientToken, proposal.ip_hash, existing.rows[0].id],
      );
    } else {
      await pool.query(
        `INSERT INTO gcc_world.clients
            (name, email, alias, email_verified, approved,
             account_type, profile_completed, client_token, ip_hash, last_seen_at)
         VALUES ($1, $1, 'Candidato', true, true, 'candidate', false, $2, $3, NOW())`,
        [cleanEmail, clientToken, proposal.ip_hash],
      );
    }

    // Marca la postulación como aprobada.
    await pool.query(
      `UPDATE gcc_world.candidate_proposals
          SET status = 'approved', decided_at = NOW(), decided_by = $1
        WHERE id = $2`,
      [user.email ?? 'admin', proposal.id],
    );

    // Correo de aprobación (sin contraseña: el candidato la define al continuar).
    try {
      await sendCandidateApprovalEmail(cleanEmail);
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
