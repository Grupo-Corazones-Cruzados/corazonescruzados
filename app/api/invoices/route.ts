import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { miembroDe } from '@/lib/projects/permisos';
import { sqlFacturaMia } from '@/lib/pertenencia';

// El DDL, una vez por proceso y no en cada clic de la lista (ver `gcc-listas-sin-ddl-ni-fila`).
let columnasListas: Promise<unknown> | null = null;
const asegurarColumnas = () =>
  (columnasListas ??= pool.query(`ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false`)
    .catch((e: unknown) => { columnasListas = null; throw e; }));

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await asegurarColumnas();

    const status = req.nextUrl.searchParams.get('status');

    // El ADMIN ve TODAS las facturas (es el dueño de la organización). El MIEMBRO, solo las de sus
    // tickets y proyectos (Fernando, 2026-11-09: «ni las facturas de otros usuarios»; ver
    // `sqlFacturaMia`). Un candidato/cliente solo las SUYAS: por su `client_id` (suscripción/factura
    // directa) o por un ticket/proyecto creado por él (`user_id`/`created_by_user_id`).
    const admin = user.role === 'admin';
    const miembro = user.role === 'member';
    let ownClientId: number = -1;
    let yo: number | null = null;
    if (miembro) {
      yo = await miembroDe(user.userId);
    } else if (!admin) {
      const cr = await pool.query(
        `SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`,
        [user.userId],
      );
      ownClientId = cr.rows[0]?.id != null ? Number(cr.rows[0].id) : -1;
    }
    // Cláusula de pertenencia: añade sus parámetros al final de `p` y se numera con ellos.
    const ownClause = (p: any[]): string => {
      if (admin) return '';
      if (miembro) {
        p.push(user.userId, yo);
        return ` AND ${sqlFacturaMia('i', `$${p.length - 1}`, `$${p.length}`)}`;
      }
      p.push(user.userId, ownClientId);
      const uP = p.length - 1, cP = p.length;
      // …y las que emitió él mismo con su cuenta de emisor (paso 4: un candidato también factura lo suyo).
      return ` AND (
          i.client_id = $${cP}
          OR i.ticket_id IN (SELECT id FROM gcc_world.tickets WHERE user_id = $${uP}::uuid OR client_id = $${cP})
          OR i.project_id IN (SELECT id FROM gcc_world.projects WHERE created_by_user_id = $${uP}::text OR client_id = $${cP})
          OR i.member_id = (SELECT member_id FROM gcc_world.users WHERE id = $${uP}::uuid)
        )`;
    };

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (status && status !== 'all') {
      params.push(status);
      where += ` AND i.status = $${params.length}`;
    }
    where += ownClause(params);

    // La lista y los conteos salen juntos: son independientes.
    const countParams: any[] = [];
    const countWhere = 'WHERE 1=1' + ownClause(countParams);
    const [{ rows }, { rows: countRows }] = await Promise.all([pool.query(
      `SELECT i.id, i.invoice_number, i.access_key, i.authorization_number, i.authorization_date,
              i.client_ruc, i.client_name_sri, i.subtotal, i.tax, i.total, i.status, i.sri_status,
              i.created_at, i.project_id, i.is_manual, i.ruc_emisor, i.razon_social_emisor, c.name as client_name
       FROM gcc_world.invoices i
       LEFT JOIN gcc_world.clients c ON c.id = i.client_id
       ${where}
       ORDER BY i.created_at DESC`,
      params
    ),
    // Conteos por estado para el rail, con la misma pertenencia que la lista.
    pool.query(
      `SELECT i.status, COUNT(*)::int AS n FROM gcc_world.invoices i ${countWhere} GROUP BY i.status`,
      countParams,
    )]);
    const counts: Record<string, number> = {};
    let allCount = 0;
    for (const r of countRows) { counts[r.status] = Number(r.n); allCount += Number(r.n); }
    counts.all = allCount;

    return NextResponse.json({ data: rows, counts });
  } catch (err: any) {
    console.error('Invoices error:', err.message);
    // Un fallo no se disfraza de «no hay facturas» (ver `gcc-no-fingir-vacio`).
    return NextResponse.json({ error: 'Error al cargar las facturas', data: [], counts: {} }, { status: 500 });
  }
}
