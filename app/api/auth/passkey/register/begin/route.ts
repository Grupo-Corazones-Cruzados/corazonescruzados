import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { RP_NAME, getWebAuthnRP } from '@/lib/world/webauthn';

type TransportLike =
  | 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';

/**
 * Registro de passkey para un USUARIO (cliente/staff) ya autenticado por JWT.
 * La passkey vive en una fila de gcc_world.clients vinculada por correo (la
 * misma que usa el login con passkey de /api/auth/passkey).
 *
 * ⚠️ `authenticatorAttachment: 'platform'` — LA HUELLA DE ESTE APARATO, NO UN CÓDIGO QR.
 *
 * ── QUÉ PASABA (Fernando, 2026-09-26) ────────────────────────────────────────────
 * «Al tratar de ingresar con passkey sale este código QR… el problema es que no puedo
 * registrar mi passkey con mi Face ID o huella digital en macOS».
 *
 * Sin `authenticatorAttachment`, WebAuthn acepta CUALQUIER autenticador, y entonces el
 * sistema abre el selector completo: llavero del dispositivo, llave USB… y «usa tu
 * teléfono o tablet», que es el del código QR. Cuando además no hay ninguna credencial
 * local que ofrecer, el navegador va directo al QR y parece que la única forma de entrar
 * fuera con otro aparato.
 *
 * Con `platform` se le pide explícitamente **el autenticador integrado**: Touch ID en el
 * Mac, Face ID en el iPhone, Windows Hello en un PC. La llave nace en el llavero del
 * sistema —en Apple, iCloud Keychain—, así que se sincroniza sola entre los aparatos de
 * la misma cuenta: se registra una vez en el Mac y el iPhone ya la tiene.
 *
 * ── LO QUE SE PIERDE, Y POR QUÉ SE ACEPTA ───────────────────────────────────────
 * Deja fuera registrar con una llave USB o con el teléfono de otro. Nadie lo ha pedido, y
 * el coste de lo contrario es el que acaba de pagarse: un QR delante de quien solo quería
 * poner el dedo. Si algún día hace falta, se añade un segundo botón que mande
 * `cualquierDispositivo: true` y esto se queda como el camino por defecto.
 */
export async function POST(req: Request) {
  // Por defecto, el autenticador de este aparato (ver arriba).
  const cuerpo = await req.json().catch(() => ({}));
  const cualquierDispositivo = cuerpo?.cualquierDispositivo === true;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const email = String(user.email).trim().toLowerCase();

    // Resuelve (o crea) la fila de "client" para este correo.
    let client = (
      await pool.query(
        `SELECT id, alias, email FROM gcc_world.clients WHERE LOWER(email) = $1
          ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
        [email],
      )
    ).rows[0];
    if (!client) {
      client = (
        await pool.query(
          `INSERT INTO gcc_world.clients (name, email, alias, last_seen_at)
           VALUES ($1, $1, $2, NOW()) RETURNING id, alias, email`,
          [email, email.split('@')[0]],
        )
      ).rows[0];
    }

    const { rpId } = await getWebAuthnRP();
    const existing = await pool.query(
      // ⚠️ SOLO LAS DEL DOMINIO ACTUAL. `excludeCredentials` existe para que el mismo
      // dispositivo no registre dos veces; si se le pasan las de antes del 2026-09-24
      // —que ya no sirven— el navegador responde «este dispositivo ya está registrado» y
      // deja a la persona SIN poder crear la que sí necesita. Justo lo contrario de lo
      // que hace falta tras el cambio de dominio (migración 062).
      `SELECT credential_id, transports FROM gcc_world.client_passkeys
        WHERE client_id = $1 AND rp_id = $2`,
      [client.id, rpId],
    );

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpId,
      userID: new TextEncoder().encode(`client-${client.id}`),
      userName: client.email || `client-${client.id}`,
      userDisplayName: client.alias || client.email || `Cliente ${client.id}`,
      attestationType: 'none',
      excludeCredentials: existing.rows.map(
        (p: { credential_id: string; transports: string[] | null }) => ({
          id: p.credential_id,
          transports: (p.transports ?? undefined) as TransportLike[] | undefined,
        }),
      ),
      authenticatorSelection: {
        authenticatorAttachment: cualquierDispositivo ? undefined : 'platform',
        // `required`: la llave se guarda en el dispositivo y se puede usar sin escribir
        // antes el correo. Es lo que hace que «entrar con passkey» sea de verdad un paso.
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    await pool.query(
      `UPDATE gcc_world.clients
          SET webauthn_challenge = $1, webauthn_challenge_exp = NOW() + INTERVAL '5 minutes'
        WHERE id = $2`,
      [options.challenge, client.id],
    );

    return NextResponse.json(options);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('User passkey register begin error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
