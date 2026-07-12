import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { takeTicket, joinProject } from '@/lib/centralized/condiciones-db';

// POST { kind:'ticket'|'project', id } — el usuario (miembro paso fundamentación) toma el
// ticket (queda asignado) o participa en el proyecto.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'member'].includes(user.role)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { kind, id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    if (kind === 'ticket') return NextResponse.json({ data: await takeTicket(user.userId, Number(id)) });
    if (kind === 'project') return NextResponse.json({ data: await joinProject(user.userId, Number(id)) });
    return NextResponse.json({ error: 'kind inválido' }, { status: 400 });
  } catch (err: any) {
    console.error('GC tomar POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
