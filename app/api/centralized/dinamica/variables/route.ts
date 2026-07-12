import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listVariablesCatalogo, createVariableCatalogo, updateVariableCatalogo, deleteVariableCatalogo } from '@/lib/centralized/condiciones-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — catálogo de variables (factor → causa → variable).
export async function GET() {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    return NextResponse.json({ data: await listVariablesCatalogo() });
  } catch (err: any) {
    console.error('Dinamica variables GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST { factor, causa, nombre, herramienta_monitoreo? }
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { factor, causa, nombre, herramienta_monitoreo } = await req.json();
    if (!factor || !causa) return NextResponse.json({ error: 'Falta factor/causa' }, { status: 400 });
    if (!nombre?.trim()) return NextResponse.json({ error: 'Falta nombre' }, { status: 400 });
    return NextResponse.json({ data: await createVariableCatalogo(factor, causa, nombre, herramienta_monitoreo) });
  } catch (err: any) {
    console.error('Dinamica variables POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH { id, nombre?, herramienta_monitoreo? }
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, nombre, herramienta_monitoreo } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    await updateVariableCatalogo(id, nombre, herramienta_monitoreo);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Dinamica variables PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE { id }
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    await deleteVariableCatalogo(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Dinamica variables DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
