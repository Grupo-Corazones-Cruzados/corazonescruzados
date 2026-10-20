import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { reunionesGoogle } from '@/lib/calendar/google';

export const dynamic = 'force-dynamic';

const MAX_DIAS = 62;

/** GET ?desde=ISO&hasta=ISO — las reuniones de la cuenta de Google del usuario (`lib/calendar/google.ts`). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const desde = new Date(req.nextUrl.searchParams.get('desde') || '');
  const hasta = new Date(req.nextUrl.searchParams.get('hasta') || '');
  if (isNaN(desde.getTime()) || isNaN(hasta.getTime()) || hasta <= desde) {
    return NextResponse.json({ error: 'Rango inválido' }, { status: 400 });
  }
  if (hasta.getTime() - desde.getTime() > MAX_DIAS * 86400_000) {
    return NextResponse.json({ error: 'Rango demasiado largo' }, { status: 400 });
  }
  try {
    const r = await reunionesGoogle(user.userId, desde, hasta);
    return NextResponse.json({ data: r.eventos, estado: r.estado, email: r.email || null });
  } catch (e: any) {
    console.error('Google Calendar (Mi día):', e?.message);
    return NextResponse.json({ error: 'No se pudieron leer las reuniones de Google', estado: 'error' }, { status: 502 });
  }
}
