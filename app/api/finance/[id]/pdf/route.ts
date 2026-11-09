import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { generateFinancePdf } from '@/lib/finance-pdf';
import { ensureFinanceTables, SQL_INGRESO_FACTURADO, renglonPdf } from '@/lib/finance';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id: idUrl } = await params;
    await ensureFinanceTables();

    // Solo un mes de ESTA cuenta (Fernando, 2026-11-09); uno ajeno da 404, como si no existiera.
    if (!/^\d{1,9}$/.test(idUrl)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { rows: [m] } = await pool.query(
      `SELECT * FROM gcc_world.finance_months WHERE id = $1 AND owner_user_id = $2::uuid`, [Number(idUrl), user.userId]
    );
    if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const id = m.id;

    // `facturado=1` (el filtro «Solo facturado» del Inicio): los ingresos, solo los facturados; los
    // egresos, solo los del SRI (sin adicionales); el ahorro y el acumulado, con ese ingreso (Fernando, 2026-10-29).
    const soloFacturado = new URL(req.url).searchParams.get('facturado') === '1';
    const { rows: items } = await pool.query(
      `SELECT fi.*, ${SQL_INGRESO_FACTURADO} AS facturado FROM gcc_world.finance_items fi WHERE fi.month_id = $1 ORDER BY fi.type, fi.sort_order, fi.id`, [id]
    );

    // Ahorro acumulado de todos los meses anteriores a este, de la misma cuenta.
    const { rows: [priorRow] } = await pool.query(
      soloFacturado
        ? `SELECT COALESCE(SUM(CASE WHEN fi.type = 'expense' AND NOT fi.adicional THEN -fi.amount WHEN ${SQL_INGRESO_FACTURADO} THEN fi.amount ELSE 0 END), 0) AS prior
             FROM gcc_world.finance_items fi JOIN gcc_world.finance_months fm ON fm.id = fi.month_id
            WHERE fm.owner_user_id = $3::uuid AND (fm.year < $1 OR (fm.year = $1 AND fm.month < $2))`
        : `SELECT COALESCE(SUM(total_savings), 0) AS prior
             FROM gcc_world.finance_months
            WHERE owner_user_id = $3::uuid AND (year < $1 OR (year = $1 AND month < $2))`,
      [m.year, m.month, user.userId]
    );
    const priorSavings = Number(priorRow?.prior) || 0;

    const monthName = MONTH_NAMES[m.month - 1];
    const ingresos = items.filter((i: any) => i.type === 'income' && (!soloFacturado || i.facturado));
    const egresos = items.filter((i: any) => i.type === 'expense' && (!soloFacturado || !i.adicional));
    const suma = (l: any[]) => l.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
    const data = [{
      year: m.year,
      month: m.month,
      monthName,
      totalIncome: suma(ingresos),
      totalExpense: suma(egresos),
      totalSavings: suma(ingresos) - suma(egresos),
      priorSavings,
      incomeItems: ingresos.map(renglonPdf),
      expenseItems: egresos.map(renglonPdf),
    }];

    const pdfBuffer = await generateFinancePdf(data, 'Reporte financiero', { subtitulo: `${monthName} ${m.year}${soloFacturado ? ' · Solo facturado' : ''}` });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Reporte-${monthName}-${m.year}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
