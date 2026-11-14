import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { estadoRuc } from '@/lib/facturacion/ruc-obligatorio';

export const dynamic = 'force-dynamic';

/** GET — si esta cuenta necesita RUC para trabajar y si ya lo tiene (para el aviso de Tickets, Proyectos y Suscripciones). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  return NextResponse.json(await estadoRuc(user as any));
}
