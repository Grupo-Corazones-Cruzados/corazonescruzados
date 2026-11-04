import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

/**
 * La dirección privada de la Mac, solo para el administrador: así no queda escrita en el código
 * público de la web. Aunque se conociera, fuera de la red de Tailscale no lleva a ningún sitio.
 */
const DIRECCION = process.env['ESPACIO_DIRECCION'] || 'https://luiss-macbook-pro-1.tail496c78.ts.net';

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== 'admin') return new NextResponse('Not Found', { status: 404 });
  return NextResponse.json({ direccion: DIRECCION });
}
