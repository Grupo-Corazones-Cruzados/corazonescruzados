import { responderDesafio } from '@/lib/registro/captcha';

/** El reto del captcha «No soy un robot» (ALTCHA). Ver `lib/registro/captcha.ts`. */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return responderDesafio(req);
}
