import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { denunciar, listarDenuncias } from '@/lib/moderacion';

export const dynamic = 'force-dynamic';

/** POST — denunciar una publicación del Marketplace o un mensaje. Cualquiera con sesión. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión para denunciar' }, { status: 401 });
  try {
    const b = await req.json();
    await denunciar(user.userId, { tipo: b.tipo, objetoId: String(b.objetoId ?? ''), motivo: b.motivo, detalle: b.detalle });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo enviar la denuncia' }, { status: 400 });
  }
}

/** GET — las denuncias, solo para administradores. `?estado=todas` incluye las resueltas. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const estado = req.nextUrl.searchParams.get('estado') === 'todas' ? 'todas' : 'pendiente';
    return NextResponse.json({ data: await listarDenuncias(estado) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudieron cargar las denuncias' }, { status: 500 });
  }
}
