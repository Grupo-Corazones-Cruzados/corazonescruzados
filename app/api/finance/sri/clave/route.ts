import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { guardarClave } from '@/lib/finance-sri';

/**
 * Guarda la clave del SRI de Fernando, CIFRADA (`lib/cifrado.ts`). Solo se escribe: ninguna ruta la
 * devuelve al navegador; la descifra únicamente el M1 al tomar un trabajo.
 */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { clave } = await req.json();
    if (typeof clave !== 'string' || clave.length < 4 || clave.length > 200) {
      return NextResponse.json({ error: 'Escribe la clave del SRI.' }, { status: 400 });
    }
    await guardarClave(clave);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
