import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { addParticipant, getProjectMembers, ensureProjectMembersTable } from '@/lib/projects/members';

/** ¿El usuario puede gestionar participantes? Admin o el responsable activo del proyecto. */
async function canManage(user: any, projectId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const memberId = (await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId])).rows[0]?.member_id;
  if (!memberId) return false;
  const p = await pool.query(`SELECT assigned_member_id FROM gcc_world.projects WHERE id = $1`, [projectId]);
  return String(p.rows[0]?.assigned_member_id || '') === String(memberId);
}

// GET — lista de miembros del proyecto (responsable + participantes).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    return NextResponse.json({ data: await getProjectMembers(id) });
  } catch (err: any) {
    console.error('Project participants GET error:', err.message);
    return NextResponse.json({ data: [] });
  }
}

// POST — agrega un participante { member_id } (responsable o admin).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    if (!(await canManage(user, id))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { member_id } = await req.json();
    if (!member_id) return NextResponse.json({ error: 'member_id requerido' }, { status: 400 });
    await addParticipant(id, member_id);
    return NextResponse.json({ data: await getProjectMembers(id) });
  } catch (err: any) {
    console.error('Project participants POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — quita un participante (?member_id=). No permite quitar al responsable.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    if (!(await canManage(user, id))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const memberId = req.nextUrl.searchParams.get('member_id');
    if (!memberId) return NextResponse.json({ error: 'member_id requerido' }, { status: 400 });
    await ensureProjectMembersTable();
    await pool.query(
      `DELETE FROM gcc_world.project_members WHERE project_id = $1 AND member_id = $2 AND role <> 'responsible'`,
      [id, memberId],
    );
    return NextResponse.json({ data: await getProjectMembers(id) });
  } catch (err: any) {
    console.error('Project participants DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
