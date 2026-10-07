import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const TIPOS: Record<string, 'android' | 'ios'> = { fcm: 'android', apns: 'ios', apns_live_start: 'ios' };

/**
 * El teléfono registra su token de push (Fernando, 2026-10-06). Lo llama la página dentro de
 * la app al abrirse con sesión (`lib/movil/reloj-nativo.ts`); repetirlo es inofensivo.
 * Cuerpo: `{ tipo: 'fcm' | 'apns' | 'apns_live_start', token }`.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { tipo, token } = await req.json().catch(() => ({}));
  const plataforma = TIPOS[String(tipo)];
  const t = String(token || '').trim();
  if (!plataforma || t.length < 10 || t.length > 4096) {
    return NextResponse.json({ error: 'Token no válido' }, { status: 400 });
  }
  try {
    await pool.query(
      `INSERT INTO gcc_world.push_devices (user_id, platform, kind, token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (kind, token) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW()`,
      [user.userId, plataforma, tipo, t],
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Registro de dispositivo:', err.message);
    return NextResponse.json({ error: 'No se pudo registrar el dispositivo' }, { status: 500 });
  }
}
