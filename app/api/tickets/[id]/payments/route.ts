import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { getTicketPayments, getTicketBilling } from '@/lib/payments';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    // `billing`: lo consumido, lo pendiente y el plan de etapas (2026-09-30), igual que el proyecto.
    const [data, billing] = await Promise.all([getTicketPayments(id), getTicketBilling(id)]);
    return NextResponse.json({ data, billing });
  } catch (err: any) {
    console.error('Ticket payments error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
