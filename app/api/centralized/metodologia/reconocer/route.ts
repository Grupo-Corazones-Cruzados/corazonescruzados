import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listReconocerCodigos } from '@/lib/centralized/metodologia-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — lista de códigos para reconocer.
export async function GET() {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    return NextResponse.json({ data: await listReconocerCodigos() });
  } catch (err: any) {
    console.error('MET reconocer GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
