import { NextResponse } from 'next/server';

/**
 * RETIRADO (seguridad, 2026-11-07). Daba la sesión SOLO con la contraseña, sin el código del correo:
 * un atajo alrededor del segundo factor. Ninguna pantalla lo usaba ya. El inicio de sesión es en dos
 * pasos: /api/auth/login/begin y /api/auth/login/verify (o la passkey).
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Usa /api/auth/login/begin y /api/auth/login/verify (segundo factor).' },
    { status: 410 },
  );
}
