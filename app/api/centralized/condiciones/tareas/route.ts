import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listAllTasks, completeTask, reopenTask } from '@/lib/centralized/condiciones-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — lista de todas las tareas.
export async function GET() {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    return NextResponse.json({ data: await listAllTasks() });
  } catch (err: any) {
    console.error('Condiciones tareas GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — completa o reabre una tarea { id, action }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, action } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    if (action === 'complete') return NextResponse.json({ data: await completeTask(Number(id)) });
    if (action === 'reopen') {
      await reopenTask(Number(id));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  } catch (err: any) {
    console.error('Condiciones tareas PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
