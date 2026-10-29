import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { generateFinancePdf } from '@/lib/finance-pdf';
import { ensureFinanceTables } from '@/lib/finance';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/**
 * El reporte de varios meses. Desde el 2026-10-29 respeta los MISMOS filtros que la tabla del
 * Inicio (Fernando: «que el botón de descargar reporte se base en los filtros aplicados»):
 *   · `anio`      — un año (`2026`); sin él, todos.
 *   · `resultado` — `ahorro` (ahorro ≥ 0) o `perdida` (< 0); sin él, todos.
 * El título y el nombre del archivo dicen qué se filtró, para que el PDF se explique solo.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role === 'client') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await ensureFinanceTables();

    const q = new URL(req.url).searchParams;
    const anio = /^\d{4}$/.test(q.get('anio') ?? '') ? Number(q.get('anio')) : null;
    const resultado = q.get('resultado') === 'ahorro' || q.get('resultado') === 'perdida' ? q.get('resultado') : null;

    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (anio) { params.push(anio); condiciones.push(`year = $${params.length}`); }
    if (resultado === 'ahorro') condiciones.push('total_savings >= 0');
    if (resultado === 'perdida') condiciones.push('total_savings < 0');
    const { rows: monthRows } = await pool.query(
      `SELECT * FROM gcc_world.finance_months ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''} ORDER BY year DESC, month DESC`,
      params,
    );

    const months = [];
    for (const m of monthRows) {
      const { rows: items } = await pool.query(
        `SELECT * FROM gcc_world.finance_items WHERE month_id = $1 ORDER BY type, sort_order, id`, [m.id]
      );
      months.push({
        year: m.year,
        month: m.month,
        monthName: MONTH_NAMES[m.month - 1],
        totalIncome: Number(m.total_income) || 0,
        totalExpense: Number(m.total_expense) || 0,
        totalSavings: Number(m.total_savings) || 0,
        incomeItems: items.filter((i: any) => i.type === 'income').map((i: any) => ({ description: i.description, amount: Number(i.amount) || 0 })),
        expenseItems: items.filter((i: any) => i.type === 'expense').map((i: any) => ({ description: i.description, amount: Number(i.amount) || 0 })),
      });
    }

    const partes = [anio ? String(anio) : null, resultado === 'ahorro' ? 'meses con ahorro' : resultado === 'perdida' ? 'meses con pérdida' : null].filter(Boolean);
    const subtitulo = partes.length ? partes.map((p) => String(p).charAt(0).toUpperCase() + String(p).slice(1)).join(' · ') : 'Global · todos los meses';
    const archivo = ['Reporte-Financiero', ...(partes.length ? partes : ['Global'])].join('-').replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const pdfBuffer = await generateFinancePdf(months, 'Reporte financiero', { subtitulo });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${archivo}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
