import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { ensureTicketActionColumns } from '@/lib/tickets/schema';
import { relojesDelMiembro } from '@/lib/tickets/relojes';

export const dynamic = 'force-dynamic';

/**
 * MIS RELOJES EN MARCHA (Fernando, 2026-10-06).
 *
 * La app del teléfono enseña el reloj de un ticket en la pantalla de bloqueo. El reloj vive
 * en el servidor (`ticket_actions.timer_started_at`), así que el teléfono pregunta aquí qué
 * hay en marcha al abrirse, al volver a primer plano y después de iniciar o detener: un reloj
 * arrancado en el computador aparece en el teléfono y uno detenido allí desaparece.
 *
 * «Míos» = los de los tickets asignados a mi miembro. Ni siquiera el administrador ve aquí los
 * de los demás: es su pantalla de bloqueo, no un tablero. Sin miembro enlazado, lista vacía
 * (y es de verdad vacía: no hay relojes que puedan ser suyos).
 *
 * La consulta vive en `lib/tickets/relojes.ts` (la usan también las push del iPhone).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    await ensureTicketActionColumns();

    const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
    const data = u?.member_id != null ? await relojesDelMiembro(Number(u.member_id)) : [];
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Relojes en marcha GET error:', err.message);
    return NextResponse.json({ error: 'No se pudieron leer los relojes' }, { status: 500 });
  }
}
