import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { tokenDeAcceso } from '@/lib/integrations/google-oauth';
import { miniatura } from '@/lib/integrations/google-drive';

export const dynamic = 'force-dynamic';

/**
 * GET — la miniatura de un archivo del Drive DEL USUARIO (con su propio token, así que
 * solo puede ver las suyas). Son unos KB: se reenvía en flujo, sin cargarla en memoria.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { fileId } = await params;
  if (!/^[\w-]{10,200}$/.test(fileId)) return new NextResponse(null, { status: 400 });
  try {
    const res = await miniatura(await tokenDeAcceso(user.userId), fileId);
    if (!res?.body) return new NextResponse(null, { status: 404 });
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
