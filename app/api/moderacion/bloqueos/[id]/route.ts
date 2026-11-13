import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { desbloquear } from '@/lib/moderacion';

export const dynamic = 'force-dynamic';

/** DELETE — desbloquear (solo los bloqueos propios). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  try {
    await desbloquear(user.userId, Number(id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo desbloquear' }, { status: 400 });
  }
}
