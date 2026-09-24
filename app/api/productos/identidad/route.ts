/**
 * LA IDENTIDAD DE UN CLIENTE, PARA LOS PRODUCTOS — UNA SOLA PUERTA.
 *
 * ── QUÉ RESUELVE ────────────────────────────────────────────────────────────────
 * Que los cinco productos puedan reconocer a un cliente de GCC World por su correo,
 * pedirle SU contraseña de siempre y exigirle el mismo segundo paso que la plataforma
 * —passkey o código al correo— sin que ninguno guarde una contraseña ni reimplemente el
 * segundo factor. La lógica está en `lib/productos/identidad.ts`; esto solo la expone.
 *
 * ── POR QUÉ UNA RUTA CON PASOS Y NO CINCO RUTAS ─────────────────────────────────
 * Porque todas comparten dos comprobaciones de las que no puede escaparse ninguna: el
 * secreto compartido y —para las de passkey— que el origen sea de la casa. Repartidas en
 * cinco archivos, la que se olvide de una sería la que alguien encuentre. Aquí se hacen
 * una vez, arriba, antes de mirar qué paso se pide.
 *
 * ── AUTENTICACIÓN ───────────────────────────────────────────────────────────────
 * `CRON_TOKEN`, el mismo secreto de servidor a servidor que ya usan el worker del agente
 * y el enlace de pago. No es una ruta pública: el navegador del cliente nunca la llama.
 * Fail-closed: sin `CRON_TOKEN` configurado, 503.
 *
 * ⚠️ El freno a la prueba de contraseñas vive en el PRODUCTO, junto a la cuenta que se
 * intenta abrir (ver `acciones/acceso.ts` de cada uno): es donde se sabe a quién se le
 * está probando la contraseña y cuántas veces seguidas.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { pool } from '@/lib/db';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import {
  clienteGccPorCorreo, claveCorrecta, mandarCodigo, codigoCorrecto,
  taparCorreo, origenDeProductoValido, rpDelProducto, fichaCliente,
} from '@/lib/productos/identidad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Transporte = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';

export async function POST(req: NextRequest) {
  if (!cronTokenConfigured())
    return NextResponse.json({ error: 'Falta CRON_TOKEN en el servidor' }, { status: 503 });
  if (!checkCronToken(req))
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

  const c = await req.json().catch(() => ({}));
  const paso = String(c.paso || '');
  const email = String(c.email || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Falta el correo.' }, { status: 400 });

  try {
    switch (paso) {
      /** ¿Es un cliente de GCC World? Lo que decide si se le pide su contraseña o la del producto. */
      case 'reconocer': {
        const cuenta = await clienteGccPorCorreo(email);
        return NextResponse.json({
          ok: true,
          esClienteGcc: !!cuenta,
          tienePasskey: cuenta?.tienePasskey ?? false,
          sinSegundoPaso: cuenta?.sinSegundoPaso ?? false,
          correoTapado: taparCorreo(email),
        });
      }

      /**
       * Paso 1: la contraseña de GCC World. NO abre nada — solo dice que es correcta y
       * qué segundos pasos tiene disponibles. La sesión la abre el producto, y solo
       * después del segundo paso.
       */
      case 'clave': {
        const cuenta = await clienteGccPorCorreo(email);
        // Se gasta el mismo tiempo aunque no sea cliente: si no, el reloj delataría
        // cuáles de los correos probados son cuentas de la plataforma.
        const vale = await claveCorrecta(email, String(c.clave || ''));
        if (!cuenta || !vale) return NextResponse.json({ ok: false }, { status: 401 });
        if (cuenta.sinSegundoPaso)
          console.info(`[identidad] acceso a producto sin segundo factor (cuenta exenta): ${cuenta.email}`);
        return NextResponse.json({
          ok: true,
          tienePasskey: cuenta.tienePasskey,
          // La exención la decide la plataforma, no el producto: él solo la obedece.
          sinSegundoPaso: cuenta.sinSegundoPaso,
          correoTapado: taparCorreo(cuenta.email),
        });
      }

      /** Manda el código. Se vuelve a exigir la contraseña para que no sea un grifo de correos. */
      case 'enviar-codigo': {
        const cuenta = await clienteGccPorCorreo(email);
        const vale = await claveCorrecta(email, String(c.clave || ''));
        if (!cuenta || !vale) return NextResponse.json({ ok: false }, { status: 401 });
        await mandarCodigo(cuenta.email, cuenta.nombre);
        return NextResponse.json({ ok: true, correoTapado: taparCorreo(cuenta.email) });
      }

      /** Paso 2 (correo). Devuelve la cuenta solo si el código es correcto y no se usó. */
      case 'comprobar-codigo': {
        const cuenta = await clienteGccPorCorreo(email);
        if (!cuenta) return NextResponse.json({ ok: false }, { status: 401 });
        if (!(await codigoCorrecto(email, String(c.codigo || ''))))
          return NextResponse.json({ ok: false, error: 'Código incorrecto o caducado.' }, { status: 401 });
        return NextResponse.json({ ok: true, cuenta: { email: cuenta.email, nombre: cuenta.nombre } });
      }

      /** Paso 2 (passkey), inicio: el reto se guarda en la ficha del cliente, como en la plataforma. */
      case 'passkey-iniciar': {
        const origen = String(c.origen || '');
        if (!origenDeProductoValido(origen))
          return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });

        const cuenta = await clienteGccPorCorreo(email);
        const ficha = cuenta ? await fichaCliente(cuenta.email.toLowerCase()) : null;
        if (!cuenta || !ficha)
          return NextResponse.json({ error: 'No hay passkeys para esta cuenta.' }, { status: 404 });

        const { rpId: rpEsperado } = rpDelProducto(origen);
        // Solo las de ESTE dominio: ofrecerle al navegador una credencial que no puede
        // casar no da un error útil, da un diálogo que no encuentra nada.
        const { rows: llaves } = await pool.query(
          `SELECT credential_id, transports FROM gcc_world.client_passkeys
            WHERE client_id = $1 AND rp_id = $2`,
          [ficha.id, rpEsperado],
        );
        if (llaves.length === 0)
          return NextResponse.json({ error: 'No hay passkeys para esta cuenta.' }, { status: 404 });

        const opciones = await generateAuthenticationOptions({
          rpID: rpEsperado,
          allowCredentials: llaves.map((l: { credential_id: string; transports: string[] | null }) => ({
            id: l.credential_id,
            transports: (l.transports ?? undefined) as Transporte[] | undefined,
          })),
          userVerification: 'preferred',
        });
        await pool.query(
          `UPDATE gcc_world.clients
              SET webauthn_challenge = $1, webauthn_challenge_exp = NOW() + INTERVAL '5 minutes'
            WHERE id = $2`,
          [opciones.challenge, ficha.id],
        );
        return NextResponse.json({ ok: true, opciones });
      }

      /** Paso 2 (passkey), final. */
      case 'passkey-terminar': {
        const origen = String(c.origen || '');
        if (!origenDeProductoValido(origen))
          return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });

        const cuenta = await clienteGccPorCorreo(email);
        if (!cuenta) return NextResponse.json({ ok: false }, { status: 401 });

        const { rows: [ficha] } = await pool.query(
          `SELECT id, webauthn_challenge, webauthn_challenge_exp FROM gcc_world.clients
            WHERE lower(email) = $1 ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
          [cuenta.email.toLowerCase()],
        );
        if (!ficha?.webauthn_challenge ||
            new Date(ficha.webauthn_challenge_exp).getTime() < Date.now())
          return NextResponse.json({ error: 'Reto caducado. Inténtalo otra vez.' }, { status: 400 });

        const credencial = c.credencial;
        const idCredencial = typeof credencial?.id === 'string' ? credencial.id : null;
        if (!idCredencial) return NextResponse.json({ error: 'Respuesta inválida.' }, { status: 400 });

        const { rows: [guardada] } = await pool.query(
          `SELECT credential_id, credential_public_key, counter, transports
             FROM gcc_world.client_passkeys WHERE client_id = $1 AND credential_id = $2 LIMIT 1`,
          [ficha.id, idCredencial],
        );
        if (!guardada) return NextResponse.json({ error: 'Passkey desconocida.' }, { status: 404 });

        const { rpId, origin } = rpDelProducto(origen);
        const v = await verifyAuthenticationResponse({
          response: credencial,
          expectedChallenge: ficha.webauthn_challenge,
          expectedOrigin: origin,
          expectedRPID: rpId,
          credential: {
            id: guardada.credential_id as string,
            publicKey: new Uint8Array(guardada.credential_public_key as Buffer),
            counter: Number(guardada.counter),
            transports: (guardada.transports as string[] | null)?.filter(
              (t): t is Transporte => typeof t === 'string') ?? undefined,
          },
          requireUserVerification: false,
        });
        if (!v.verified) return NextResponse.json({ error: 'Verificación fallida.' }, { status: 401 });

        await pool.query(
          `UPDATE gcc_world.client_passkeys SET counter = $1, last_used_at = NOW() WHERE credential_id = $2`,
          [v.authenticationInfo.newCounter, guardada.credential_id],
        );
        // El reto se gasta siempre: si sobreviviera, serviría para una segunda entrada.
        await pool.query(
          `UPDATE gcc_world.clients SET webauthn_challenge = NULL, webauthn_challenge_exp = NULL WHERE id = $1`,
          [ficha.id],
        );
        return NextResponse.json({ ok: true, cuenta: { email: cuenta.email, nombre: cuenta.nombre } });
      }

      default:
        return NextResponse.json({ error: 'Paso desconocido.' }, { status: 400 });
    }
  } catch (e: unknown) {
    console.error('[identidad] ', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'No se pudo completar.' }, { status: 500 });
  }
}
