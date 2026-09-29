import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
// ⚠️ Antes ninguna de estas llamadas miraba quién pedía: cualquiera con sesión podía crear
// y ACEPTAR asignaciones, que es lo que fija cuánto se le paga a un miembro (2026-09-28).
import { esGestorDelProyecto, miembroDe, requerimientoDelProyecto, ESTADOS_CERRADOS } from '@/lib/projects/permisos';

async function proyectoCerrado(projectId: string): Promise<boolean> {
  const { rows: [p] } = await pool.query(`SELECT status FROM gcc_world.projects WHERE id = $1`, [projectId]);
  return !p || ESTADOS_CERRADOS.includes(p.status);
}

async function syncFinalCost(projectId: string) {
  await pool.query(
    `UPDATE gcc_world.projects SET final_cost = (
      SELECT COALESCE(SUM(COALESCE(ra.member_cost, ra.proposed_cost)), 0)
      FROM gcc_world.requirement_assignments ra
      WHERE ra.project_id = $1 AND ra.status = 'accepted'
    ), updated_at = NOW() WHERE id = $1`,
    [projectId]
  );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT ra.*, m.name as member_name
       FROM gcc_world.requirement_assignments ra
       JOIN gcc_world.members m ON m.id = ra.member_id
       WHERE ra.project_id = $1
       ORDER BY ra.created_at`,
      [id]
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { requirement_id, member_id, proposed_cost } = await req.json();

    // Asignar es del gestor del proyecto, sobre un requerimiento SUYO y con el proyecto abierto.
    if (!(await requerimientoDelProyecto(requirement_id, id))) {
      return NextResponse.json({ error: 'El requerimiento no pertenece a este proyecto.' }, { status: 404 });
    }
    if (await proyectoCerrado(id)) {
      return NextResponse.json({ error: 'No se pueden asignar miembros en el estado actual del proyecto.' }, { status: 400 });
    }
    if (!(await esGestorDelProyecto(user, id))) {
      return NextResponse.json({ error: 'Solo el responsable del proyecto puede asignar miembros.' }, { status: 403 });
    }

    const userRes = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
    const callerMemberId = userRes.rows[0]?.member_id;
    const isSelfAssign = callerMemberId != null && Number(callerMemberId) === Number(member_id);

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.requirement_assignments (project_id, requirement_id, member_id, proposed_cost, member_cost, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, requirement_id, member_id, proposed_cost, isSelfAssign ? proposed_cost : null, isSelfAssign ? 'accepted' : 'proposed']
    );

    if (isSelfAssign) await syncFinalCost(id);

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { assignment_id, action, member_cost } = await req.json();

    // La asignación tiene que ser de ESTE proyecto, y el proyecto seguir abierto.
    const { rows: [asig] } = await pool.query(
      `SELECT member_id FROM gcc_world.requirement_assignments WHERE id = $1 AND project_id = ($2)::bigint`,
      [assignment_id, id],
    );
    if (!asig) return NextResponse.json({ error: 'La asignación no existe en este proyecto.' }, { status: 404 });
    if (await proyectoCerrado(id)) {
      return NextResponse.json({ error: 'No se pueden cambiar asignaciones en el estado actual del proyecto.' }, { status: 400 });
    }
    // Contraofertar es del miembro al que va la asignación; aceptar o rechazar, del gestor.
    if (action === 'counter') {
      const yo = await miembroDe(user.userId);
      if (yo == null || Number(asig.member_id) !== yo) {
        return NextResponse.json({ error: 'Solo el miembro propuesto puede contraofertar.' }, { status: 403 });
      }
    } else if (!(await esGestorDelProyecto(user, id))) {
      return NextResponse.json({ error: 'Solo el responsable del proyecto puede aceptar o rechazar.' }, { status: 403 });
    }

    if (action === 'counter') {
      await pool.query(
        `UPDATE gcc_world.requirement_assignments SET member_cost = $1, status = 'counter', updated_at = NOW() WHERE id = $2`,
        [member_cost, assignment_id]
      );
    } else if (action === 'accept') {
      await pool.query(
        `UPDATE gcc_world.requirement_assignments SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
        [assignment_id]
      );
      await syncFinalCost(id);
    } else if (action === 'reject') {
      await pool.query(
        `UPDATE gcc_world.requirement_assignments SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
        [assignment_id]
      );
      await syncFinalCost(id);
    }

    const { rows } = await pool.query(`SELECT ra.*, m.name as member_name FROM gcc_world.requirement_assignments ra JOIN gcc_world.members m ON m.id = ra.member_id WHERE ra.id = $1`, [assignment_id]);
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
