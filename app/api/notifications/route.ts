import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

// Notificaciones del usuario. Hoy: invitaciones a proyectos (a liderar vía
// project_members role='responsible' status='invited', y a participar vía
// project_bids status='invited'). A futuro se sumarán otros tipos aquí.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // member_id del usuario (las invitaciones de proyecto son por miembro).
    const { rows: [me] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
    const memberId = me?.member_id;
    if (!memberId) return NextResponse.json({ data: [] });

    const { rows } = await pool.query(
      `SELECT p.id AS project_id, p.title, 'participant' AS kind, pb.created_at AS invited_at
         FROM gcc_world.project_bids pb
         JOIN gcc_world.projects p ON p.id = pb.project_id
        WHERE pb.member_id = $1 AND pb.status = 'invited'
       UNION ALL
       SELECT p.id AS project_id, p.title, 'responsible' AS kind, pm.created_at AS invited_at
         FROM gcc_world.project_members pm
         JOIN gcc_world.projects p ON p.id = pm.project_id
        WHERE pm.member_id = $1 AND pm.role = 'responsible' AND pm.status = 'invited'
       ORDER BY invited_at DESC`,
      [memberId],
    );

    const data = rows.map((r: any) => ({
      id: `${r.kind}-${r.project_id}`,
      type: 'project_invitation',
      kind: r.kind, // 'participant' | 'responsible'
      title: r.title,
      project_id: r.project_id,
      href: `/dashboard/projects/${r.project_id}`,
      invited_at: r.invited_at,
    }));
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Notifications GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
