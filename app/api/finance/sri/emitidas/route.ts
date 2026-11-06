import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { encolarEmitidas, estadoEmitidas } from '@/lib/finance-sri-emitidas';

/**
 * El botón «Facturas emitidas» del Inicio. Solo el admin, porque usa su clave del SRI.
 *   GET  → la última consulta y su resultado.
 *   POST → `{ year, month }`: deja la consulta de ese mes en la cola del M1.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    return NextResponse.json({ data: await estadoEmitidas() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { year, month } = await req.json();
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2024) {
      return NextResponse.json({ error: 'Elige un mes válido.' }, { status: 400 });
    }
    const estado = await estadoEmitidas();
    if (!estado.claveConfigurada) return NextResponse.json({ error: 'Falta la clave del SRI: guárdala en «Gastos del SRI».' }, { status: 409 });
    const t = await encolarEmitidas(String(user.userId), year, month);
    return NextResponse.json({ data: { ...t, ...(await estadoEmitidas()) } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
