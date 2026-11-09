import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse, after } from 'next/server';
import { avisarInvitacionProyecto } from '@/lib/projects/members';
import { esGestorDelProyecto } from '@/lib/projects/permisos';
import { encaja, talentosAbiertosDelProyecto, top5DeMiembros } from '@/lib/talentos/demostrados';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { member_ids } = await req.json();

    if (!member_ids?.length) return NextResponse.json({ error: 'member_ids required' }, { status: 400 });
    // Invitar es del gestor del proyecto (2026-11-09: antes bastaba con tener sesión).
    if (!(await esGestorDelProyecto({ userId: String(user.userId), role: user.role }, id))) {
      return NextResponse.json({ error: 'Solo el responsable del proyecto invita' }, { status: 403 });
    }

    // Validate project status allows invitations
    const { rows: [proj] } = await pool.query(`SELECT status FROM gcc_world.projects WHERE id = $1`, [id]);
    if (!proj) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    if (['draft', 'review', 'completed', 'cancelled', 'closed'].includes(proj.status)) {
      return NextResponse.json({ error: 'No se puede invitar en el estado actual del proyecto' }, { status: 400 });
    }

    // Require unassigned requirements
    const { rows: [unassigned] } = await pool.query(
      `SELECT COUNT(*) as cnt FROM gcc_world.project_requirements r
       WHERE r.project_id = $1 AND NOT EXISTS (
         SELECT 1 FROM gcc_world.requirement_assignments ra WHERE ra.requirement_id = r.id AND ra.status = 'accepted'
       )`, [id]
    );
    if (Number(unassigned.cnt) === 0) {
      return NextResponse.json({ error: 'No hay requerimientos sin asignar. Crea requerimientos primero.' }, { status: 400 });
    }

    // ⭐ Solo se invita a quien tiene demostrado algún talento que el proyecto pide (top 5;
    // Fernando, 2026-11-09). Una sola consulta para todos los invitados.
    const pedidos = await talentosAbiertosDelProyecto(id);
    if (pedidos.length) {
      const tops = await top5DeMiembros(member_ids);
      const fuera = member_ids.filter((m: any) => !encaja(tops.get(String(m)) || [], pedidos));
      if (fuera.length) {
        return NextResponse.json({ error: 'Alguna de las personas no tiene demostrado ninguno de los talentos que pide el proyecto.' }, { status: 400 });
      }
    }

    const nuevos: (number | string)[] = [];
    for (const memberId of member_ids) {
      const { rowCount } = await pool.query(
        `INSERT INTO gcc_world.project_bids (project_id, member_id, status)
         VALUES ($1, $2, 'invited')
         ON CONFLICT (project_id, member_id) DO NOTHING`,
        [id, memberId]
      );
      if (rowCount) nuevos.push(memberId);
    }
    after(() => avisarInvitacionProyecto(id, nuevos, 'participant'));
    return NextResponse.json({ message: 'Invited' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
