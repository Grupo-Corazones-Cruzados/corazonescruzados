import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { emisorDe, guardarEmisor, puedeFacturar } from '@/lib/facturacion-emisores';

export const dynamic = 'force-dynamic';

/**
 * Configuración → Facturación: la cuenta de emisor de QUIEN PREGUNTA (sin la firma: solo titular y vencimiento).
 * No admite otro usuario: el de la sesión y punto.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const userId = String(user.userId);
  if (!(await puedeFacturar(userId))) return NextResponse.json({ error: 'Tu cuenta no factura.' }, { status: 403 });
  return NextResponse.json({ data: await emisorDe(userId) }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * PUT — registra o cambia MIS datos de emisor. Solo su dueño: un administrador que mira como otro
 * (`suplantadoPor`) no puede, porque con estos datos se factura a nombre de esa persona.
 */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  if (user.suplantadoPor) {
    return NextResponse.json({ error: 'La cuenta de emisor solo la cambia su dueño, no se puede mirando como otro.' }, { status: 403 });
  }
  const userId = String(user.userId);
  if (!(await puedeFacturar(userId))) return NextResponse.json({ error: 'Tu cuenta no factura.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const r = await guardarEmisor(userId, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ data: r.emisor });
}
