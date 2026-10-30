import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { encolarSincronizacion, estadoSincronizacion } from '@/lib/finance-sri';

/**
 * El botón «Actualizar gastos del SRI» del Inicio (ver `lib/finance-sri.ts`). Solo el admin: son
 * los gastos personales de Fernando y su clave del SRI.
 *   GET  → cómo va: el último trabajo, si el M1 está atento y qué meses faltan por revisar.
 *   POST → deja un trabajo en la cola para el M1.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    return NextResponse.json({ data: await estadoSincronizacion() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const estado = await estadoSincronizacion();
    if (!estado.claveConfigurada) return NextResponse.json({ error: 'Falta la clave del SRI.' }, { status: 409 });
    const t = await encolarSincronizacion(String(user.userId));
    return NextResponse.json({ data: { ...t, ...(await estadoSincronizacion()) } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
