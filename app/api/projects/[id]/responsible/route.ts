import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProjectMembersTable, setResponsible } from '@/lib/projects/members';

/**
 * Aceptar / rechazar la INVITACIÓN a tomar el liderazgo (responsable) de un proyecto.
 * El miembro invitado (en "Solicitar proyecto") decide:
 *  - accept  → pasa a responsable ACTIVO y queda como assigned_member_id (poderes de creador).
 *  - decline → se elimina la invitación; el proyecto queda abierto.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { action } = await req.json();
    await ensureProjectMembersTable();

    // Miembro del usuario actual.
    const memberId = (await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId])).rows[0]?.member_id;
    if (!memberId) return NextResponse.json({ error: 'No tienes un perfil de miembro' }, { status: 400 });

    // Debe existir una invitación de responsable pendiente para este miembro.
    const inv = await pool.query(
      `SELECT id FROM gcc_world.project_members WHERE project_id = $1 AND member_id = $2 AND role = 'responsible' AND status = 'invited' LIMIT 1`,
      [id, memberId],
    );
    if (!inv.rows[0]) return NextResponse.json({ error: 'No tienes una invitación de liderazgo pendiente' }, { status: 403 });

    if (action === 'accept') {
      await setResponsible(id, memberId, { invited: false });
      return NextResponse.json({ ok: true, status: 'active' });
    }
    // decline
    await pool.query(`DELETE FROM gcc_world.project_members WHERE project_id = $1 AND member_id = $2 AND role = 'responsible' AND status = 'invited'`, [id, memberId]);
    return NextResponse.json({ ok: true, status: 'declined' });
  } catch (err: any) {
    console.error('Project responsible POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
