import { NextRequest, NextResponse } from 'next/server';
import { validateQuoteToken } from '@/lib/cotizaciones/schema';
import { loadQuote } from '@/lib/cotizaciones/data';

/** Vista pública (SOLO LECTURA) de la cotización, validada por token. Sin sesión. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    const token = new URL(req.url).searchParams.get('token') || '';
    await validateQuoteToken(id, token);
    const q = await loadQuote(id);
    if (!q) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    return NextResponse.json({ data: q });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: err.status || 500 });
  }
}
