import { NextResponse } from 'next/server';

/**
 * RETIRADO (seguridad, 2026-11-07). Daba la sesión del personaje SOLO con la contraseña, sin el código
 * del correo, y ni el juego ni la web lo llamaban ya. Se entra con member-login/begin + verify, la
 * recuperación (recover/begin + verify) o la passkey.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Usa member-login/begin y member-login/verify (segundo factor).' },
    { status: 410 },
  );
}
