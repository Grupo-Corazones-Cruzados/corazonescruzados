import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listResearchProjects, createResearchProject, updateResearchProject, deleteResearchProject } from '@/lib/centralized/metodologia-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — lista de proyectos de investigación.
export async function GET() {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    return NextResponse.json({ data: await listResearchProjects() });
  } catch (err: any) {
    console.error('MET proyectos GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea un proyecto de investigación { name, purpose }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { name, purpose } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    return NextResponse.json({ data: await createResearchProject(name, purpose) });
  } catch (err: any) {
    console.error('MET proyectos POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza un proyecto de investigación { id, name?, purpose? }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, name, purpose } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await updateResearchProject(Number(id), name, purpose);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('MET proyectos PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina un proyecto de investigación { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteResearchProject(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('MET proyectos DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
