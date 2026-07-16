import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { generateClientToken } from '@/lib/world/session';
import { sendCandidateApprovalEmail } from '@/lib/integrations/resend';
import { splitBaseCounter, isValidUsername } from '@/lib/workspace/username';

/** Devuelve el primer usuario libre `base{n}` (revisa clients + users). */
async function resolveFreeUsername(desired: string): Promise<string | null> {
  const { base, start } = splitBaseCounter(desired);
  if (!base) return null;
  for (let n = start; n < start + 1000; n++) {
    const candidate = `${base}${n}`;
    if (!isValidUsername(candidate)) continue;
    const taken = await pool.query(
      `SELECT 1 FROM gcc_world.clients WHERE workspace_username = $1
       UNION SELECT 1 FROM gcc_world.users WHERE LOWER(email) = $2 LIMIT 1`,
      [candidate, `${candidate}@grupocc.org`],
    );
    if (taken.rowCount === 0) return candidate;
  }
  return null;
}

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

    const body = await req.json().catch(() => ({}));
    const desiredUsername = String(body?.username || '').trim().toLowerCase();

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
         ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false,
         ADD COLUMN IF NOT EXISTS workspace_username text,
         ADD COLUMN IF NOT EXISTS workspace_email text`,
    );

    // Usuario corporativo definido por el aprobador (nomenclatura). Se garantiza único
    // (contador). La cuenta de Google se crea después, al completar la cuenta el candidato.
    let workspaceUsername: string | null = null;
    if (desiredUsername) {
      if (!isValidUsername(splitBaseCounter(desiredUsername).base + '0')) {
        return NextResponse.json({ error: 'Nombre de usuario inválido' }, { status: 400 });
      }
      workspaceUsername = await resolveFreeUsername(desiredUsername);
      if (!workspaceUsername) {
        return NextResponse.json({ error: 'No se pudo asignar un usuario libre' }, { status: 409 });
      }
    }
    const workspaceEmail = workspaceUsername ? `${workspaceUsername}@grupocc.org` : null;

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
                client_token = $1, ip_hash = COALESCE($2, ip_hash),
                workspace_username = COALESCE($4, workspace_username),
                workspace_email = COALESCE($5, workspace_email)
          WHERE id = $3`,
        [clientToken, proposal.ip_hash, existing.rows[0].id, workspaceUsername, workspaceEmail],
      );
    } else {
      await pool.query(
        `INSERT INTO gcc_world.clients
            (name, email, alias, email_verified, approved,
             account_type, profile_completed, client_token, ip_hash, last_seen_at,
             workspace_username, workspace_email)
         VALUES ($1, $1, 'Candidato', true, true, 'candidate', false, $2, $3, NOW(), $4, $5)`,
        [cleanEmail, clientToken, proposal.ip_hash, workspaceUsername, workspaceEmail],
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

    return NextResponse.json({ ok: true, emailSent: true, username: workspaceUsername, workspaceEmail });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Approve proposal error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
