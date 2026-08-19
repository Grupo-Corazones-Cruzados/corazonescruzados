import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { getBillableProjects } from '@/lib/payments';

/**
 * Proyectos que se pueden facturar por etapas, con el detalle de cada etapa
 * (importe, si está entregada y si ya tiene factura). Alimenta el selector del
 * módulo de facturas. Las cotizaciones no aparecen: aún no son trabajo contratado.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const data = await getBillableProjects();
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Billable projects error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
