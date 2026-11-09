import { NextRequest, NextResponse } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { reintentarFacturasDeCobros } from '@/lib/pagos/facturas-del-cobro';

/**
 * Reintenta las facturas de cobros que quedaron sin crear o sin respuesta del SRI (fase 4, paso 4: cada miembro
 * factura lo suyo y cada factura va por su lado). Lo llama el cron frecuente (`scripts/frequent-cron.mjs`) con
 * `x-cron-token`, o un admin a mano. Idempotente: una factura por (cobro, emisor) y el SRI se consulta antes de
 * reenviar.
 */
export async function POST(req: NextRequest) {
  if (!checkCronToken(req)) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      if (!cronTokenConfigured()) return NextResponse.json({ error: 'Cron no configurado (falta CRON_TOKEN)' }, { status: 503 });
      return NextResponse.json({ error: 'Token de cron inválido' }, { status: 401 });
    }
  }
  try {
    return NextResponse.json({ ok: true, ...(await reintentarFacturasDeCobros()) });
  } catch (err: any) {
    console.error('Reintento de facturas de cobros:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
