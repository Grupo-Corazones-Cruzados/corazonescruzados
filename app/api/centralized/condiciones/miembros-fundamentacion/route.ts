import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listMembersFundamentacion } from '@/lib/centralized/condiciones-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — miembros de paso fundamentación (posibles asignados de tickets/proyectos).
export async function GET() {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    return NextResponse.json({ data: await listMembersFundamentacion() });
  } catch (err: any) {
    console.error('GC miembros-fundamentacion GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
