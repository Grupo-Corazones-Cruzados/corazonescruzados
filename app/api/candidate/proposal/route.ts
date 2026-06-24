import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getClientIp, hashIp } from '@/lib/world/session';
import { sendCandidateProposalVerificationEmail } from '@/lib/integrations/resend';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tabla TEMPORAL de propuestas de candidatos (pendientes de aprobación del
 * administrador global). Al aprobarse + verificarse + crear cuenta, la fila se
 * migra a un registro de candidato (gcc_world.clients) y se elimina de aquí.
 */
async function ensureProposalsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.candidate_proposals (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      reason TEXT,
      marketing BOOLEAN DEFAULT FALSE,
      ip_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      email_verified BOOLEAN DEFAULT FALSE,
      verification_token TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      decided_at TIMESTAMPTZ,
      decided_by TEXT
    )
  `);
}

// POST — registra una nueva propuesta (bloquea reutilización del correo).
export async function POST(req: Request) {
  try {
    const { email, reason, marketing } = await req.json();
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanReason = typeof reason === 'string' ? reason.trim() : '';

    if (!EMAIL_RE.test(cleanEmail)) {
      return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
    }
    if (cleanReason.length < 10) {
      return NextResponse.json(
        { error: 'Cuéntanos tu motivación (mínimo 10 caracteres)' },
        { status: 400 },
      );
    }

    await ensureProposalsTable();

    // El correo no puede reutilizarse para una nueva propuesta.
    const existing = await pool.query(
      `SELECT id, status FROM gcc_world.candidate_proposals WHERE email = $1 LIMIT 1`,
      [cleanEmail],
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        {
          error:
            'Ese correo ya tiene una postulación registrada. Espera la aprobación del administrador.',
          status: existing.rows[0].status,
        },
        { status: 409 },
      );
    }

    const ipHash = hashIp(await getClientIp());
    const token = randomBytes(32).toString('hex');

    await pool.query(
      `INSERT INTO gcc_world.candidate_proposals
         (email, reason, marketing, ip_hash, status, verification_token)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [cleanEmail, cleanReason, marketing === true, ipHash, token],
    );

    // Envío del correo de verificación (best-effort: no bloquea la postulación).
    try {
      await sendCandidateProposalVerificationEmail(cleanEmail, token);
    } catch (err) {
      console.error('Proposal verification email failed:', err);
    }

    return NextResponse.json({ ok: true, status: 'pending' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Candidate proposal error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET — estado de la propuesta del visitante actual (reconocido por su IP).
export async function GET() {
  try {
    await ensureProposalsTable();
    const ipHash = hashIp(await getClientIp());
    const r = await pool.query(
      `SELECT email, status, email_verified
         FROM gcc_world.candidate_proposals
        WHERE ip_hash = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [ipHash],
    );
    const row = r.rows[0];
    if (!row) return NextResponse.json({ exists: false });
    return NextResponse.json({
      exists: true,
      status: row.status,
      emailVerified: !!row.email_verified,
      email: row.email,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Candidate proposal status error:', msg);
    return NextResponse.json({ exists: false, error: msg }, { status: 500 });
  }
}
