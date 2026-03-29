import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { sendInvoiceToSri } from '@/lib/integrations/sri';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const result = await sendInvoiceToSri(Number(id));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('SRI send error:', err.message);
    return NextResponse.json({ ok: false, authorized: false, error: err.message }, { status: 500 });
  }
}
