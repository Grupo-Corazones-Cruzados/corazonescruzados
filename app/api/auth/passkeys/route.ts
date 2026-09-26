import { NextResponse, type NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getWebAuthnRP } from '@/lib/world/webauthn';

/**
 * LAS PASSKEYS DE QUIEN HA INICIADO SESIÓN: verlas, y quitar la que ya no use.
 *
 * ── POR QUÉ HIZO FALTA (Fernando, 2026-09-26) ────────────────────────────────────
 * «No puedo registrar mi passkey con mi Face ID o huella digital en macOS».
 *
 * El motivo de fondo no era WebAuthn: era que **el único sitio donde se podía crear una
 * passkey era el modal de acceso, y solo aparecía a quien no tenía ninguna**. Fernando ya
 * tenía una —registrada en otro aparato—, así que la oferta no volvía a salir nunca y no
 * había forma de añadir la del Mac. Quedaba encerrado: no podía entrar con la passkey
 * (no está en ese equipo) y tampoco crear una que sí lo estuviera.
 *
 * Una passkey es *de un aparato* aunque se sincronice; tener varias es lo normal, no la
 * excepción. Así que dejan de vivir escondidas en el acceso y pasan a Configuración,
 * donde se ven, se añaden y se quitan.
 *
 * ⚠️ Solo se tocan las del usuario de la sesión: se resuelven por su correo, nunca por un
 * identificador que venga del navegador.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** La ficha del mundo donde cuelgan las passkeys de este correo. */
async function fichaDe(email: string): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT id FROM gcc_world.clients WHERE lower(email) = $1
      ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
    [email],
  );
  return rows[0]?.id ?? null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const clientId = await fichaDe(String(user.email).trim().toLowerCase());
  if (!clientId) return NextResponse.json({ passkeys: [] });

  const { rpId } = await getWebAuthnRP();
  const { rows } = await pool.query(
    `SELECT id, device_type, backed_up, rp_id, created_at, last_used_at
       FROM gcc_world.client_passkeys
      WHERE client_id = $1
      ORDER BY created_at DESC`,
    [clientId],
  );

  return NextResponse.json({
    passkeys: rows.map((p: Record<string, unknown>) => ({
      id: p.id,
      // ⚠️ `sirve` es lo que decide si se puede usar HOY: una passkey nacida con otro
      // dominio (antes del 2026-09-24) sigue en la tabla pero ningún navegador la acepta.
      // Enseñarla sin decirlo haría creer que se tiene acceso cuando no.
      sirve: p.rp_id === rpId,
      sincronizada: p.device_type === 'multiDevice' || p.backed_up === true,
      creada: p.created_at,
      usada: p.last_used_at,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: 'Falta la passkey.' }, { status: 400 });

  const clientId = await fichaDe(String(user.email).trim().toLowerCase());
  if (!clientId) return NextResponse.json({ error: 'No hay passkeys.' }, { status: 404 });

  // ⚠️ El `client_id` va en el WHERE, no solo el id: sin él, cualquiera con sesión podría
  // borrar la passkey de otro pasando un número.
  const r = await pool.query(
    `DELETE FROM gcc_world.client_passkeys WHERE id = $1 AND client_id = $2`,
    [id, clientId],
  );
  if (r.rowCount === 0)
    return NextResponse.json({ error: 'Esa passkey no es tuya.' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
