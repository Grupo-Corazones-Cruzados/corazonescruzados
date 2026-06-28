import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/candidate/verify?token=... — marca el correo de la propuesta como verificado.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  // Usa el dominio PÚBLICO para la redirección. Detrás del proxy (Railway) req.url
  // apunta al host interno (localhost:8080), así que tomamos NEXT_PUBLIC_APP_URL.
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const home = new URL('/', base);

  if (!token) {
    home.searchParams.set('candidato', 'token-invalido');
    return NextResponse.redirect(home);
  }

  try {
    const r = await pool.query(
      `UPDATE gcc_world.candidate_proposals
          SET email_verified = TRUE
        WHERE verification_token = $1
        RETURNING id`,
      [token],
    );
    home.searchParams.set(
      'candidato',
      r.rows.length > 0 ? 'correo-verificado' : 'token-invalido',
    );
  } catch (err) {
    console.error('Candidate verify error:', err);
    home.searchParams.set('candidato', 'error');
  }

  return NextResponse.redirect(home);
}
