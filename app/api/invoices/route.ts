import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Ensure is_manual column exists
    await pool.query(`ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false`);

    const status = req.nextUrl.searchParams.get('status');

    // Staff (miembro/admin) ve TODAS las facturas. Un candidato/cliente solo ve las SUYAS:
    // las facturas están asociadas a una suscripción/proyecto/ticket, así que se incluyen las
    // que le pertenecen por su `client_id` (suscripción/factura directa) o por un ticket/
    // proyecto creado por él (`user_id`/`created_by_user_id`).
    const staff = user.role === 'admin' || user.role === 'member';
    let ownClientId: number = -1;
    if (!staff) {
      const cr = await pool.query(
        `SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`,
        [user.userId],
      );
      ownClientId = cr.rows[0]?.id != null ? Number(cr.rows[0].id) : -1;
    }
    // Cláusula de pertenencia; `uP`/`cP` son los índices de los parámetros userId/clientId.
    const ownClause = (uP: number, cP: number) =>
      ` AND (
          i.client_id = $${cP}
          OR i.ticket_id IN (SELECT id FROM gcc_world.tickets WHERE user_id = $${uP}::uuid OR client_id = $${cP})
          OR i.project_id IN (SELECT id FROM gcc_world.projects WHERE created_by_user_id = $${uP}::text OR client_id = $${cP})
        )`;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (status && status !== 'all') {
      params.push(status);
      where += ` AND i.status = $${params.length}`;
    }
    if (!staff) {
      params.push(user.userId, ownClientId);
      where += ownClause(params.length - 1, params.length);
    }

    const { rows } = await pool.query(
      `SELECT i.id, i.invoice_number, i.access_key, i.authorization_number, i.authorization_date,
              i.client_ruc, i.client_name_sri, i.subtotal, i.tax, i.total, i.status, i.sri_status,
              i.created_at, i.project_id, i.is_manual, c.name as client_name
       FROM gcc_world.invoices i
       LEFT JOIN gcc_world.clients c ON c.id = i.client_id
       ${where}
       ORDER BY i.created_at DESC`,
      params
    );

    // Conteos por estado para el rail. Global para staff; acotado a las propias para el resto.
    const countParams: any[] = [];
    let countWhere = '';
    if (!staff) {
      countParams.push(user.userId, ownClientId);
      countWhere = 'WHERE 1=1' + ownClause(1, 2);
    }
    const { rows: countRows } = await pool.query(
      `SELECT i.status, COUNT(*)::int AS n FROM gcc_world.invoices i ${countWhere} GROUP BY i.status`,
      countParams,
    );
    const counts: Record<string, number> = {};
    let allCount = 0;
    for (const r of countRows) { counts[r.status] = Number(r.n); allCount += Number(r.n); }
    counts.all = allCount;

    return NextResponse.json({ data: rows, counts });
  } catch (err: any) {
    console.error('Invoices error:', err.message);
    return NextResponse.json({ data: [], counts: {} });
  }
}
