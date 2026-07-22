import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureQuoteTables, normalizeAdditionalCosts } from '@/lib/cotizaciones/schema';

/**
 * Edita manualmente los COSTOS ADICIONALES (servicios de proveedores externos) de la
 * cotización. Recalcula el total del proyecto (requerimientos + adicionales). Solo el
 * responsable o admin.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id: idStr } = await params;
    const id = Number(idStr);
    await ensureQuoteTables();

    const { rows: [p] } = await pool.query(`SELECT assigned_member_id, created_by_user_id FROM gcc_world.projects WHERE id = $1`, [id]);
    if (!p) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    const uRow = (await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId])).rows[0] || {};
    const owner = user.role === 'admin' || (uRow.member_id && Number(uRow.member_id) === Number(p.assigned_member_id)) || p.created_by_user_id === user.userId;
    if (!owner) return NextResponse.json({ error: 'No tienes acceso' }, { status: 403 });

    const body = await req.json();
    const items = normalizeAdditionalCosts(body.additional_costs);

    const { rows: [rt] } = await pool.query(`SELECT COALESCE(SUM(cost), 0) AS s FROM gcc_world.project_requirements WHERE project_id = $1`, [id]);
    const reqSubtotal = Number(rt.s) || 0;
    const addTotal = items.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    await pool.query(
      `UPDATE gcc_world.projects SET additional_costs = $1::jsonb, final_cost = $2, updated_at = NOW() WHERE id = $3`,
      [JSON.stringify(items), reqSubtotal + addTotal, id],
    );
    return NextResponse.json({ data: { additional_costs: items, total: reqSubtotal + addTotal } });
  } catch (err: any) {
    console.error('additional-costs error:', err.message);
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}
