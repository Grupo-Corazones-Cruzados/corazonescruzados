import { NextRequest, NextResponse } from 'next/server';
import { esTrabajador, registrarResultado, tomarTrabajo, type ResultadoMes } from '@/lib/finance-sri';
import { registrarEmitidas, type DiaEmitido } from '@/lib/finance-sri-emitidas';

/**
 * La puerta del M1 (`services/m1-sri/trabajador.mjs`). Se entra con su token (`Authorization:
 * Bearer …`), nunca con sesión. Cada pregunta deja anotado que el M1 está atento.
 *   GET  → toma el siguiente trabajo (204 si no hay).
 *   POST → devuelve lo que encontró: `{ id, meses: ResultadoMes[], error? }`, o `{ id, dias, error? }`
 *          si el trabajo era una consulta de facturas emitidas.
 */
export async function GET(req: NextRequest) {
  if (!(await esTrabajador(req.headers.get('authorization')))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const t = await tomarTrabajo();
    if (!t) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ data: t }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[sri] tomar trabajo:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await esTrabajador(req.headers.get('authorization')))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id, meses, dias, error } = await req.json();
    if (Number.isFinite(Number(id)) && Array.isArray(dias)) {
      return NextResponse.json({ data: await registrarEmitidas(Number(id), dias as DiaEmitido[], error ? String(error) : null) });
    }
    if (!Number.isFinite(Number(id)) || !Array.isArray(meses)) return NextResponse.json({ error: 'Falta el resultado.' }, { status: 400 });
    const r = await registrarResultado(Number(id), meses as ResultadoMes[], error ? String(error) : null);
    return NextResponse.json({ data: r });
  } catch (err: any) {
    console.error('[sri] registrar resultado:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
