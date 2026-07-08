import { getCurrentUser } from '@/lib/auth/jwt';
import { setGeneratedStatus, setGeneratedLabels } from '@/lib/centralized/horario-db';
import { VALORES_SET } from '@/lib/centralized/valores';
import { TALENTOS_SET } from '@/lib/centralized/talentos';
import { NextResponse } from 'next/server';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// PATCH — actualiza una TAREA GENERADA por una política de Comandos Violeta.
//  · { id, status }          → cambia el estado del día (pending/completed/failed).
//  · { id, values, talents } → fija las etiquetas de TODA la tarea (todos sus días).
// Las tareas generadas son fijas: no se crean ni se eliminan desde aquí (eso lo hace la
// activación/desactivación de la política).
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const b = await req.json();
    const id = Number(b.id);
    if (!id) return NextResponse.json({ error: 'Falta la tarea' }, { status: 400 });

    if (typeof b.status === 'string') {
      if (!['pending', 'completed', 'failed'].includes(b.status)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
      await setGeneratedStatus(id, b.status);
      return NextResponse.json({ ok: true });
    }

    if (Array.isArray(b.values) || Array.isArray(b.talents)) {
      const values = Array.isArray(b.values) ? b.values.map(String).filter((v: string) => VALORES_SET.has(v)) : [];
      const talents = Array.isArray(b.talents) ? b.talents.map(String).filter((t: string) => TALENTOS_SET.has(t)) : [];
      await setGeneratedLabels(id, values, talents);
      return NextResponse.json({ ok: true, values, talents });
    }

    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  } catch (err: any) {
    console.error('Horario generated PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
