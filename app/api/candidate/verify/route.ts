import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { avisarReclutamiento } from '@/lib/avisos/reclutamiento';

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
    // `antes` = cómo estaba: solo la PRIMERA verificación avisa al equipo (el enlace del correo
    // se puede volver a abrir).
    const r = await pool.query(
      `UPDATE gcc_world.candidate_proposals p
          SET email_verified = TRUE
         FROM (SELECT id, COALESCE(email_verified, FALSE) AS antes
                 FROM gcc_world.candidate_proposals WHERE verification_token = $1) v
        WHERE p.id = v.id
        RETURNING p.id, p.email, v.antes`,
      [token],
    );
    const nueva = r.rows[0];
    if (nueva && !nueva.antes) {
      after(() => avisarReclutamiento('postulacion_verificada', {
        titulo: 'Postulante verificó su correo',
        mensaje: `${nueva.email} ya puede ser aprobado.`,
        consulta: `solicitud=${nueva.id}`,
      }));
    }
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
