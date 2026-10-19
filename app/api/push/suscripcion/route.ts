import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { borrarSuscripcion, guardarSuscripcion } from '@/lib/push';

/**
 * POST — guarda la suscripción push de este navegador para la persona con sesión.
 * DELETE — la quita (`{ endpoint }`): desactivar los avisos en este dispositivo.
 */
const valida = (b: any) =>
  typeof b?.endpoint === 'string' && /^https:\/\//.test(b.endpoint) && b.endpoint.length < 1000
  && typeof b?.keys?.p256dh === 'string' && typeof b?.keys?.auth === 'string';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!valida(b)) return NextResponse.json({ error: 'Suscripción no válida' }, { status: 400 });
  await guardarSuscripcion(String(user.userId), b, req.headers.get('user-agent')?.slice(0, 300) || null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (typeof b?.endpoint !== 'string') return NextResponse.json({ error: 'Falta el endpoint' }, { status: 400 });
  await borrarSuscripcion(String(user.userId), b.endpoint);
  return NextResponse.json({ ok: true });
}
