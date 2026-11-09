import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureFinanceTables, ensureMonth, addProjectIncomeToFinance, addTicketIncomeToFinance, SQL_INGRESO_FACTURADO, nombrarIngresosFacturados, sqlSinEtapasFacturadas, DUENO_FINANZAS_GCC, tieneFinanzasPropias } from '@/lib/finance';
import { nombrarPendientes } from '@/lib/pagos/nombre-estandar';

/**
 * Backfill: register completed/invoiced projects and completed tickets.
 * Uses finance_source_log to skip sources that were ever registered
 * (even if the admin later deleted the item manually).
 *
 * ⚠️ Lo que se cobra por etapas no se anota entero: cada etapa ya entra por su factura.
 */
async function backfillIncomes() {
  // Seed log from existing items (one-time catch-up for items registered before the log existed)
  await pool.query(`
    INSERT INTO gcc_world.finance_source_log (source_type, source_id)
    SELECT DISTINCT source_type, source_id FROM gcc_world.finance_items
    WHERE source_type IS NOT NULL AND source_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);

  // 1. Completed projects not yet in source log
  const { rows: completedProjects } = await pool.query(`
    SELECT p.id, p.title, p.final_cost, p.updated_at
    FROM gcc_world.projects p
    WHERE p.status = 'completed'
      AND ${sqlSinEtapasFacturadas('project_id', 'p.id')}
      AND NOT EXISTS (SELECT 1 FROM gcc_world.finance_source_log l WHERE l.source_type = 'project' AND l.source_id = CAST(p.id AS TEXT))
  `);
  for (const p of completedProjects) {
    await addProjectIncomeToFinance(String(p.id), p.title, Number(p.final_cost) || 0, new Date(p.updated_at || Date.now()));
  }

  // 2. Invoiced but non-completed projects not yet in source log
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.invoice_projects (
    id SERIAL PRIMARY KEY, invoice_id INT NOT NULL, project_id TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  const { rows: invoicedProjects } = await pool.query(`
    SELECT DISTINCT p.id, p.title, p.final_cost, i.created_at as invoice_date
    FROM gcc_world.projects p
    JOIN gcc_world.invoices i ON (i.project_id = p.id OR EXISTS (
      SELECT 1 FROM gcc_world.invoice_projects ip WHERE ip.project_id = CAST(p.id AS TEXT) AND ip.invoice_id = i.id
    ))
    WHERE i.status != 'cancelled' AND p.status != 'completed'
      AND ${sqlSinEtapasFacturadas('project_id', 'p.id')}
      AND NOT EXISTS (SELECT 1 FROM gcc_world.finance_source_log l WHERE l.source_type = 'project' AND l.source_id = CAST(p.id AS TEXT))
  `);
  for (const p of invoicedProjects) {
    await addProjectIncomeToFinance(String(p.id), p.title, Number(p.final_cost) || 0, new Date(p.invoice_date || Date.now()));
  }

  // 3. Completed tickets not yet in source log
  const { rows: completedTickets } = await pool.query(`
    SELECT t.id, t.title, t.estimated_cost, t.updated_at
    FROM gcc_world.tickets t
    WHERE t.status = 'completed' AND t.estimated_cost IS NOT NULL AND t.estimated_cost > 0
      AND ${sqlSinEtapasFacturadas('ticket_id', 't.id')}
      AND NOT EXISTS (SELECT 1 FROM gcc_world.finance_source_log l WHERE l.source_type = 'ticket' AND l.source_id = CAST(t.id AS TEXT))
  `);
  for (const t of completedTickets) {
    await addTicketIncomeToFinance(String(t.id), t.title, Number(t.estimated_cost) || 0, new Date(t.updated_at || Date.now()));
  }
}

// Estado a nivel de proceso (Railway = servidor Node persistente) para no repetir
// trabajo pesado en cada carga del dashboard. La lista de meses se devuelve al instante;
// el backfill (SELECTs + inserts por fila) se ejecuta como mucho una vez por minuto.
let tablesReady = false;
let ensuredMonthKey = '';
let lastBackfill = 0;
const BACKFILL_INTERVAL_MS = 60_000;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // ⭐ CADA CUENTA VE SU ESTADO FINANCIERO (Fernando, 2026-11-09): miembros, administradores y
    // candidatos, cada uno el suyo —quizá vacío—. El cliente de negocio no tiene.
    if (!(await tieneFinanzasPropias(user))) return NextResponse.json({ data: [] });

    // Crear tablas una sola vez por proceso.
    if (!tablesReady) { await ensureFinanceTables(); tablesReady = true; }

    // El mes actual, una vez por mes/proceso, SOLO en la cuenta donde se anota lo automático: a cada
    // cuenta que visita el Inicio no se le crea un mes vacío (cada uno abre los suyos con el POST).
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    if (ensuredMonthKey !== monthKey) {
      await ensureMonth(DUENO_FINANZAS_GCC, now.getFullYear(), now.getMonth() + 1);
      ensuredMonthKey = monthKey;
    }

    // Backfill throttled: no bloquea cada carga (los meses ya se devuelven abajo). Lo que anota va a
    // `DUENO_FINANZAS_GCC` (ver `addIncomeToFinance`), sea quien sea el que abre el Inicio.
    if (Date.now() - lastBackfill > BACKFILL_INTERVAL_MS) {
      lastBackfill = Date.now();
      try { await backfillIncomes(); } catch (e: any) { console.error('Backfill error:', e.message); }
      // Y cada ingreso facturado, con el nombre de su factura (ver `nombrarIngresosFacturados`).
      try { await nombrarIngresosFacturados(); } catch (e: any) { console.error('Nombrar ingresos:', e.message); }
      // Los tickets/proyectos pagados que se quedaron sin su nombre estándar (el proceso murió a
      // mitad de la llamada a la IA). Sin esperar: no frena la carga del panel.
      void nombrarPendientes().catch((e) => console.error('Nombre estándar:', e.message));
    }

    // `facturado_income`: lo que de los ingresos del mes tiene factura (ver SQL_INGRESO_FACTURADO).
    // `adicional_income`/`adicional_expense`: lo escrito a mano en la columna Adicionales, que va
    // INCLUIDO en `total_income`/`total_expense` (Fernando, 2026-10-30).
    const { rows } = await pool.query(
      `SELECT fm.*,
              COALESCE((SELECT SUM(fi.amount) FROM gcc_world.finance_items fi
                         WHERE fi.month_id = fm.id AND ${SQL_INGRESO_FACTURADO}), 0) AS facturado_income,
              COALESCE((SELECT SUM(fi.amount) FROM gcc_world.finance_items fi
                         WHERE fi.month_id = fm.id AND fi.adicional AND fi.type = 'income'), 0) AS adicional_income,
              COALESCE((SELECT SUM(fi.amount) FROM gcc_world.finance_items fi
                         WHERE fi.month_id = fm.id AND fi.adicional AND fi.type = 'expense'), 0) AS adicional_expense
         FROM gcc_world.finance_months fm
        WHERE fm.owner_user_id = $1::uuid
        ORDER BY fm.year DESC, fm.month DESC`,
      [user.userId]
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST: abre un mes en la cuenta de quien tiene la sesión (para anotar sus adicionales). Cualquier cuenta
 * con estado financiero propio (ver `tieneFinanzasPropias`); el cliente de negocio, no. Si ya existe,
 * devuelve el que hay.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!(await tieneFinanzasPropias(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await ensureFinanceTables();
    const body = await req.json().catch(() => ({}));
    const year = Number(body?.year);
    const month = Number(body?.month);
    if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || year > 2100 || month < 1 || month > 12) {
      return NextResponse.json({ error: 'year y month requeridos' }, { status: 400 });
    }

    const monthId = await ensureMonth(user.userId, year, month);
    const { rows: [m] } = await pool.query(`SELECT * FROM gcc_world.finance_months WHERE id = $1`, [monthId]);

    return NextResponse.json({ data: m }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
