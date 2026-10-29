/**
 * EL CAPTCHA DE LOS REGISTROS — postulación de candidato y alta de cliente (Fernando, 2026-10-29:
 * «vamos a requerir usar captcha para validar que no sea un robot»).
 *
 * Es ALTCHA (código abierto, alojado aquí): el navegador resuelve una prueba de trabajo (PBKDF2)
 * que a una persona le cuesta un segundo y a un robot que manda miles de filas le sale caro. No
 * hay cuenta en Google ni Cloudflare, ni cookies de rastreo. El widget es `components/landing/
 * Captcha.tsx`; el reto lo sirve `/api/registro/desafio` y aquí se verifica.
 *
 * · Firma: `ALTCHA_HMAC_SECRET` si existe; si no, se deriva de `JWT_SECRET` (así funciona sin
 *   tocar Railway, y cada entorno tiene su propia firma).
 * · Cada reto vale 10 minutos y UNA sola vez (`CappedMap`: un id usado no se acepta otra vez).
 *   Vive en memoria: un despliegue la vacía, pero los retos caducan igual a los 10 minutos.
 */

import { createHmac } from 'node:crypto';
import { create, CappedMap, randomInt } from 'altcha-lib/frameworks/nextjs';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';

const base = process.env.ALTCHA_HMAC_SECRET || process.env.JWT_SECRET || 'gcc-altcha-local';
const firma = createHmac('sha256', base).update('gcc-altcha-firma').digest('hex');
const firmaClave = createHmac('sha256', base).update('gcc-altcha-clave').digest('hex');

// Los ids de reto ya usados: una solución no vale dos veces.
const usados = new CappedMap({ maxSize: 10_000 });

const altcha = create({
  deriveKey,
  hmacSignatureSecret: firma,
  hmacKeySignatureSecret: firmaClave,
  store: usados,
  createChallengeParameters: () => ({
    algorithm: 'PBKDF2/SHA-256',
    cost: 5_000,
    counter: randomInt(5_000, 10_000),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  }),
});

/** GET del reto (lo pide el widget). */
export const responderDesafio = altcha.challengeHandler;

/**
 * ¿La solución que trae el cuerpo es válida? `payload` es el campo `altcha` del JSON del
 * formulario. Devuelve `null` si vale, o el motivo si no.
 */
export async function verificarCaptcha(payload: unknown): Promise<string | null> {
  if (typeof payload !== 'string' || !payload) return 'Confirma que no eres un robot.';
  try {
    const r = await altcha.verify(payload, deriveKey, firma, firmaClave, usados);
    return r.error || !r.verification?.verified ? 'La verificación de «No soy un robot» no es válida o caducó. Vuelve a marcarla.' : null;
  } catch {
    return 'La verificación de «No soy un robot» no es válida o caducó. Vuelve a marcarla.';
  }
}
