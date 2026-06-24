import { NextResponse } from 'next/server';

// DEPRECADO: el login de miembro ahora es en 2 pasos con código (2FA).
// Usa /api/character/auth/member-login/begin y /member-login/verify.
export async function POST() {
  return NextResponse.json(
    { error: 'Usa member-login/begin y member-login/verify (2FA).' },
    { status: 410 },
  );
}
