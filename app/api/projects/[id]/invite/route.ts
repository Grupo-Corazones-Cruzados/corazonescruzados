import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { member_ids } = await req.json();

    if (!member_ids?.length) return NextResponse.json({ error: 'member_ids required' }, { status: 400 });

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

    for (const memberId of member_ids) {
      await pool.query(
        `INSERT INTO gcc_world.project_bids (project_id, member_id, status)
         VALUES ($1, $2, 'invited')
         ON CONFLICT (project_id, member_id) DO NOTHING`,
        [id, memberId]
      );
    }
    return NextResponse.json({ message: 'Invited' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
