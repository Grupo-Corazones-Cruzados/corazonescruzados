import { NextRequest, NextResponse } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { avisarFirmasPorVencer } from '@/lib/facturacion-emisores';

/**
 * Aviso de firmas electrónicas a 30 días de vencer (campanita + correo, una vez por certificado). Lo llama el cron
 * nocturno (`scripts/frequent-cron.mjs › NIGHTLY_JOBS`) con `x-cron-token`, o un admin a mano.
 * `?simular=1` (admin): a quién avisaría hoy, sin avisar ni guardar nada.
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
    const simular = req.nextUrl.searchParams.get('simular') === '1';
    return NextResponse.json({ ok: true, ...(await avisarFirmasPorVencer(simular)) });
  } catch (err: any) {
    console.error('Avisos de firma por vencer:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
