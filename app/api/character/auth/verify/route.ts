import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
} from '@/lib/world/session';
import { ensureClientColumns } from '@/lib/clients/account';

function html(title: string, message: string, color = '#7B5FBF'): Response {
  const body = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${title} — GCC World</title>
<style>
body{margin:0;background:#0a0a14;color:#e5e5e5;font-family:'Courier New',monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
.card{max-width:520px;width:100%;background:#131923;border:2px solid ${color};padding:36px 28px;text-align:center;box-shadow:6px 6px 0 rgba(0,0,0,0.4);}
h1{margin:0 0 12px;color:${color};letter-spacing:0.18em;font-size:1.2rem;text-transform:uppercase;}
p{color:#cbd5e1;font-size:.95rem;line-height:1.6;margin:0 0 20px;}
a{display:inline-block;background:${color};color:#0a0a14;text-decoration:none;padding:12px 28px;font-weight:bold;border:2px solid ${color};letter-spacing:0.08em;}
</style></head><body><div class="card"><h1>${title}</h1><p>${message}</p><a href="/">Volver al juego</a></div></body></html>`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) return html('Token faltante', 'Enlace inválido.', '#a13333');
    await ensureClientColumns();

    const r = await pool.query(
      `SELECT id, alias, pending_email, pending_password_hash, verification_expires
         FROM gcc_world.clients
        WHERE verification_token = $1
        LIMIT 1`,
      [token],
    );
    const row = r.rows[0];
    if (!row) {
      return html(
        'Enlace no válido',
        'Este enlace ya fue usado o no existe.',
        '#a13333',
      );
    }
    if (
      !row.verification_expires ||
      new Date(row.verification_expires).getTime() < Date.now()
    ) {
      return html(
        'Enlace expirado',
        'Este enlace ya expiró. Vuelve al juego e inténtalo de nuevo.',
        '#a13333',
      );
    }
    if (!row.pending_email || !row.pending_password_hash) {
      return html(
        'Sin datos pendientes',
        'No hay registro pendiente para confirmar.',
        '#a13333',
      );
    }

    const authToken = randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE gcc_world.clients
          SET email = $1,
              password_hash = $2,
              email_verified = TRUE,
              status = CASE WHEN account_type = 'client' THEN 'activo' ELSE status END,
              pending_email = NULL,
              pending_password_hash = NULL,
              verification_token = NULL,
              verification_expires = NULL,
              auth_token = $3,
              auth_expires = NOW() + INTERVAL '30 days',
              last_seen_at = NOW()
        WHERE id = $4`,
      [row.pending_email, row.pending_password_hash, authToken, row.id],
    );

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE, authToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: AUTH_COOKIE_MAX_AGE,
    });

    return html(
      '¡Cuenta confirmada!',
      `Bienvenido${row.alias ? `, ${row.alias}` : ''}. Tu cuenta está activa. Vuelve al juego para continuar.`,
      '#7B5FBF',
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Verify error:', msg);
    return html('Error', msg, '#a13333');
  }
}
