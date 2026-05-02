import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { regenerateRejectedInvoice, sendInvoiceToSri } from '@/lib/integrations/sri';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const stripInvisible = (s: any) => typeof s === 'string' ? s.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').trim() : s;
    const digitsOnly = (s: any) => typeof s === 'string' ? s.replace(/\D/g, '') : s;

    await regenerateRejectedInvoice(Number(id), {
      clientIdType: stripInvisible(body.clientIdType),
      clientRuc: digitsOnly(stripInvisible(body.clientRuc)),
      clientName: stripInvisible(body.clientName),
      clientEmail: stripInvisible(body.clientEmail),
      clientPhone: digitsOnly(stripInvisible(body.clientPhone)),
      clientAddress: stripInvisible(body.clientAddress),
      items: body.items,
    });

    const retry = body.retry !== false;
    if (!retry) return NextResponse.json({ ok: true, authorized: false });

    const result = await sendInvoiceToSri(Number(id));
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Invoice regenerate error:', err.message);
    return NextResponse.json({ ok: false, authorized: false, error: err.message }, { status: 500 });
  }
}
