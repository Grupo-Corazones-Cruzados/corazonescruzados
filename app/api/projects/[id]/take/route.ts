import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { setResponsible } from '@/lib/projects/members';
import { memberTalents } from '@/lib/tickets/bids';
import { createNotification } from '@/lib/notifications';

// POST — un miembro con el talento requerido TOMA el proyecto abierto-por-talento y queda
// como RESPONSABLE de inmediato (sin invitación/propuesta). Luego puede tomar requerimientos
// o abrir el proyecto a propuestas para los requerimientos aún no tomados.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'member'].includes(user.role)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    const projectId = Number(id);

    const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
    const memberId = u?.member_id;
    if (!memberId) return NextResponse.json({ error: 'Necesitas un perfil de miembro para tomar el proyecto.' }, { status: 403 });

    const { rows: [p] } = await pool.query(
      `SELECT open_for_talent, assigned_member_id, required_talents, created_by_user_id, title FROM gcc_world.projects WHERE id = $1`, [projectId]);
    if (!p) return NextResponse.json({ error: 'Proyecto inexistente' }, { status: 404 });
    if (!p.open_for_talent || p.assigned_member_id) return NextResponse.json({ error: 'Este proyecto ya no está disponible para tomar.' }, { status: 400 });

    const mine = await memberTalents(memberId);
    const required: string[] = p.required_talents || [];
    if (!required.some((r) => mine.includes(r))) {
      return NextResponse.json({ error: 'Necesitas al menos uno de los talentos requeridos para hacerte responsable.' }, { status: 403 });
    }

    await setResponsible(projectId, memberId, { invited: false });
    await pool.query(`UPDATE gcc_world.projects SET open_for_talent = false, is_private = true, status = 'in_progress' WHERE id = $1`, [projectId]);

    try {
      if (p.created_by_user_id) await createNotification(String(p.created_by_user_id), {
        type: 'project_taken', title: p.title, message: 'Un miembro con el talento requerido se hizo responsable de tu proyecto.', link: `/dashboard/projects/${projectId}`,
      });
    } catch { /* noop */ }

    return NextResponse.json({ data: { member_id: memberId } });
  } catch (err: any) {
    console.error('Project take POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
