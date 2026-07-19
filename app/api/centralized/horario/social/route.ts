import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolveSubject } from '@/lib/centralized/subject';
import { setSocialTaskStatus, type SignupStatus } from '@/lib/centralized/gestion-social-db';

export const dynamic = 'force-dynamic';

const STATUSES: SignupStatus[] = ['pending', 'completed', 'failed'];

/**
 * PATCH `{ id, status }` — estado de una tarea de Gestión Social tomada por el usuario.
 *
 * A diferencia de los otros endpoints de horario (que exigen `['admin','member']`), aquí
 * se resuelve el SUJETO del logueado y se permite también a un CANDIDATO — decisión del
 * usuario: los candidatos participan en experiencias y su cumplimiento puntúa igual.
 * La autorización real es de fila: `setSocialTaskStatus` solo actualiza si la toma es
 * SUYA y el evento está `active` (de ahí el bloqueo antes del inicio y tras el fin).
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const subject = await resolveSubject(user);
    if (!subject) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const b = await req.json();
    const id = Number(b?.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Tarea no válida.' }, { status: 400 });
    if (!STATUSES.includes(b?.status)) return NextResponse.json({ error: 'Estado no válido.' }, { status: 400 });

    await setSocialTaskStatus(id, subject.kind, subject.id, b.status);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Regla de negocio (evento no en curso / toma ajena) → 409.
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}
