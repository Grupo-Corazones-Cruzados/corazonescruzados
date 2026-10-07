import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const TIPOS: Record<string, 'android' | 'ios'> = {
  fcm: 'android', apns: 'ios', apns_live_start: 'ios', apns_live_update: 'ios',
};

/**
 * El teléfono registra un token de push (Fernando, 2026-10-06/07). Repetirlo es inofensivo.
 * Cuerpo: `{ tipo, token, entorno?, registroId? }`.
 *  · Android lo manda desde la página al abrirse con sesión.
 *  · iPhone lo manda desde la app nativa (con la misma cookie de sesión): el token de arranque
 *    de Actividades en Vivo y, por cada actividad abierta, su token con el registro al que
 *    pertenece (`apns_live_update` + `registroId`). `entorno`: `sandbox` (Xcode) o
 *    `production` (TestFlight).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { tipo, token, entorno, registroId } = await req.json().catch(() => ({}));
  const plataforma = TIPOS[String(tipo)];
  const t = String(token || '').trim();
  if (!plataforma || t.length < 10 || t.length > 4096) {
    return NextResponse.json({ error: 'Token no válido' }, { status: 400 });
  }
  const env = plataforma === 'ios' ? (entorno === 'sandbox' ? 'sandbox' : 'production') : null;
  const registro = tipo === 'apns_live_update' ? Number(registroId) : null;
  if (tipo === 'apns_live_update' && !(Number.isInteger(registro) && registro! > 0)) {
    return NextResponse.json({ error: 'Falta el registro de la actividad' }, { status: 400 });
  }
  try {
    await pool.query(
      `INSERT INTO gcc_world.push_devices (user_id, platform, kind, token, entorno, registro_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (kind, token) DO UPDATE
         SET user_id = EXCLUDED.user_id, entorno = EXCLUDED.entorno,
             registro_id = EXCLUDED.registro_id, updated_at = NOW()`,
      [user.userId, plataforma, tipo, t, env, registro],
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Registro de dispositivo:', err.message);
    return NextResponse.json({ error: 'No se pudo registrar el dispositivo' }, { status: 500 });
  }
}
