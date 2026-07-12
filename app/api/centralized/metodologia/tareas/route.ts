import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listTasks, createTask, updateTask, deleteTask } from '@/lib/centralized/metodologia-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — lista de tareas de un proyecto ?research_project_id=.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const researchProjectId = Number(new URL(req.url).searchParams.get('research_project_id'));
    if (!researchProjectId) return NextResponse.json({ error: 'Falta el research_project_id' }, { status: 400 });
    return NextResponse.json({ data: await listTasks(researchProjectId) });
  } catch (err: any) {
    console.error('MET tareas GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea una tarea { research_project_id, titulo, notas, codigo_ids }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { research_project_id, titulo, notas, codigo_ids } = await req.json();
    if (!research_project_id) return NextResponse.json({ error: 'Falta el research_project_id' }, { status: 400 });
    if (!titulo?.trim()) return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
    return NextResponse.json({ data: await createTask(research_project_id, titulo, notas || '', codigo_ids || []) });
  } catch (err: any) {
    console.error('MET tareas POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza una tarea { id, titulo?, notas?, estado? }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, titulo, notas, estado } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await updateTask(Number(id), titulo, notas, estado);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('MET tareas PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina una tarea { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteTask(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('MET tareas DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
