import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { getTaskCodigos } from '@/lib/centralized/condiciones-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — códigos de una tarea ?task_id=.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('task_id'));
    if (!id) return NextResponse.json({ error: 'Falta task_id' }, { status: 400 });
    return NextResponse.json({ data: await getTaskCodigos(id) });
  } catch (err: any) {
    console.error('Condiciones tarea-codigos GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
