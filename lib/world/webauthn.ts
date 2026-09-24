import { headers } from 'next/headers';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

export const RP_NAME = 'GCC World';

/**
 * ⚠️ EL DOMINIO QUE GOBIERNA LAS PASSKEYS — Y POR QUÉ NO ES EL HOST.
 *
 * Una passkey queda atada al «RP ID» con el que se creó, y solo se puede usar desde un
 * origen cuyo dominio sea ese o termine en él. Con el RP ID igual al host, una passkey
 * hecha en `www.grupocc.org` **no vale** en `app.grupocc.org` ni en
 * `automatizaciones.grupocc.org`: son hermanos, no descendientes.
 *
 * Como los cinco productos viven cada uno en su subdominio y Fernando quiere el mismo
 * segundo paso en todos (2026-09-24), el RP ID pasa a ser el dominio registrable:
 * **`grupocc.org`**. Así UNA passkey vale en la plataforma, en el juego y en cada
 * producto, que es lo que espera quien la registró: es su llave, no la llave de una URL.
 *
 * ⚠️ Esto **invalida las passkeys creadas antes**, porque nacieron con otro RP ID. En el
 * momento del cambio había dos, las dos de Fernando; se vuelven a registrar una vez y ya
 * sirven para todo. No hay forma de migrarlas: la clave privada vive en el dispositivo y
 * está atada a ese nombre.
 *
 * Fuera de `grupocc.org` (localhost, las URL `*.up.railway.app`) se sigue usando el host,
 * que es lo único válido allí.
 */
export function dominioDeLasPasskeys(hostname: string): string {
  return hostname === 'grupocc.org' || hostname.endsWith('.grupocc.org')
    ? 'grupocc.org'
    : hostname;
}

function deriveOriginAndRpId() {
  try {
    const u = new URL(APP_URL);
    return { origin: u.origin, rpId: dominioDeLasPasskeys(u.hostname) };
  } catch {
    return { origin: 'http://localhost:3002', rpId: 'localhost' };
  }
}

// Fallback estático (basado en env). Se mantiene por compatibilidad y
// como respaldo cuando no hay contexto de petición.
export const { origin: RP_ORIGIN, rpId: RP_ID } = deriveOriginAndRpId();

// RP por petición. WebAuthn exige que el RP ID coincida con el dominio
// efectivo de la página, así que se deriva del Host de la request:
// funciona en localhost y en cualquier host desplegado. Si no hay
// contexto de petición, cae al valor estático del env.
export async function getWebAuthnRP(): Promise<{
  rpId: string;
  origin: string;
}> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    if (host) {
      const isLocal =
        host.startsWith('localhost') || host.startsWith('127.0.0.1');
      const proto =
        h.get('x-forwarded-proto') || (isLocal ? 'http' : 'https');
      const hostname = host.split(':')[0];
      return { rpId: dominioDeLasPasskeys(hostname), origin: `${proto}://${host}` };
    }
  } catch {
    // headers() fuera de contexto de petición → usar fallback.
  }
  return { rpId: RP_ID, origin: RP_ORIGIN };
}
