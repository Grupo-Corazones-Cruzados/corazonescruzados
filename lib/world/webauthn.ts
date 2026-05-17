import { headers } from 'next/headers';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

export const RP_NAME = 'GCC World';

function deriveOriginAndRpId() {
  try {
    const u = new URL(APP_URL);
    return { origin: u.origin, rpId: u.hostname };
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
      return { rpId: hostname, origin: `${proto}://${host}` };
    }
  } catch {
    // headers() fuera de contexto de petición → usar fallback.
  }
  return { rpId: RP_ID, origin: RP_ORIGIN };
}
