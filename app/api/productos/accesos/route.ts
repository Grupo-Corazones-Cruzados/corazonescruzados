import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { accesosDelUsuario } from '@/lib/productos/accesos';

export const dynamic = 'force-dynamic';

/** Los inquilinos de los productos a los que puede entrar la cuenta con sesión, por anfitrión del producto. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const accesos = await accesosDelUsuario(user.email);
  return NextResponse.json({ data: accesos });
}
