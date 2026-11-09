import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { comprobanteDe } from '@/lib/pagos-miembros';
import { descargaDeDrive } from '@/lib/media/descarga-privada';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cobros/pagos/<id>/comprobante — el comprobante de una transferencia a un miembro. Lo ven la persona
 * a la que se le pagó y el administrador; a cualquier otro, 404 (ni siquiera sabe que existe). No pasa por
 * `/api/media`, que sirve sin sesión.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return new NextResponse(null, { status: 404 });
  const c = await comprobanteDe(id);
  if (!c || (user.role !== 'admin' && c.userId !== String(user.userId))) return new NextResponse(null, { status: 404 });
  return descargaDeDrive([{ id: c.fileId, nombre: c.nombre, mime: c.mime, tamano: 0 }], c.fileId);
}
