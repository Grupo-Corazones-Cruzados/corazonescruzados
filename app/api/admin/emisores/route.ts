import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { listarEmisores, cambiarEstado, ErrorEmisor, ESTADOS_ADMIN } from '@/lib/facturacion-emisores';
import type { EstadoEmisor } from '@/lib/integrations/sri/emisor';

export const dynamic = 'force-dynamic';

/**
 * ADMIN → EMISORES. Solo administradores (quien mira como otro pierde el rol: `TokenPayload.suplantadoPor`).
 *   GET                 → todas las cuentas de emisor (sin firma: titular, vencimiento y si casa con el RUC).
 *   PATCH { id, estado } → en_pruebas | activo | suspendido. Queda en `sri_emisor_log`.
 */
async function admin() {
  const user = await getCurrentUser();
  return user && user.role === 'admin' ? user : null;
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  return NextResponse.json({ data: await listarEmisores() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  const estado = String(body?.estado ?? '') as EstadoEmisor;
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Cuenta no válida' }, { status: 400 });
  if (!ESTADOS_ADMIN.includes(estado)) return NextResponse.json({ error: 'Estado no válido' }, { status: 400 });
  try {
    await cambiarEstado(id, estado, String(user.userId));
    return NextResponse.json({ data: await listarEmisores() });
  } catch (e: any) {
    if (e instanceof ErrorEmisor) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[emisores] cambiar estado', id, e?.message);
    return NextResponse.json({ error: 'No se pudo cambiar el estado.' }, { status: 500 });
  }
}
