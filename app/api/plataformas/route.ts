import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { plataformasDelUsuario } from '@/lib/productos/plataformas';

export const dynamic = 'force-dynamic';

/** Las soluciones y las plataformas (organizaciones en productos) de la cuenta con sesión. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    return NextResponse.json(await plataformasDelUsuario(user.email));
  } catch (e: any) {
    console.error('[plataformas] GET:', e.message);
    return NextResponse.json({ error: 'No se pudieron cargar las plataformas' }, { status: 500 });
  }
}
