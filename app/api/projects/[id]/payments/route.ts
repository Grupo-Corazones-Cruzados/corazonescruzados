import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { getProjectPayments, getProjectBilling } from '@/lib/payments';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const data = await getProjectPayments(id);
    const billing = await getProjectBilling(id);
    return NextResponse.json({ data, billing });
  } catch (err: any) {
    console.error('Project payments error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
