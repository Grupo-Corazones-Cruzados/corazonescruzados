import { NextResponse } from 'next/server';

/**
 * ⛔ CERRADA (Fernando, 2026-10-29). Era una vía antigua de alta que ya no usa ninguna pantalla (ni
 * la portada, ni la app móvil, ni el juego) y seguía abierta SIN captcha ni límite de 24 h:
 * cualquiera podía crear cuentas llamándola directamente. Las altas vigentes son
 * `/api/auth/register` (cliente) y `/api/candidate/proposal` (postulación), las dos con captcha y
 * límite. Para ver el código de antes: `git show d3377faf:app/api/client/signup/route.ts`.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Esta vía de registro ya no existe. Crea tu cuenta desde la página de inicio.' },
    { status: 410 },
  );
}
