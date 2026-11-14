import { NextRequest, NextResponse } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { purgarCandidatosSinAlta } from '@/lib/candidatos/purga';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** POST — borra los candidatos aprobados que no llenaron el formulario de alta en 7 días. Ver `lib/candidatos/purga.ts`. */
export async function POST(req: NextRequest) {
  if (!checkCronToken(req)) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      if (!cronTokenConfigured()) return NextResponse.json({ error: 'Cron no configurado (falta CRON_TOKEN)' }, { status: 503 });
      return NextResponse.json({ error: 'Token de cron inválido' }, { status: 401 });
    }
  }
  try {
    const r = await purgarCandidatosSinAlta();
    return NextResponse.json({ ok: true, borrados: r.borrados.length, fallidos: r.fallidos.length });
  } catch (err: any) {
    console.error('[candidatos] purga:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
