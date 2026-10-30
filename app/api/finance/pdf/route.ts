import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { generateFinancePdf } from '@/lib/finance-pdf';
import { ensureFinanceTables, SQL_INGRESO_FACTURADO, renglonPdf } from '@/lib/finance';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/**
 * El reporte de varios meses. Desde el 2026-10-29 respeta los MISMOS filtros que la tabla del
 * Inicio (Fernando: «que el botón de descargar reporte se base en los filtros aplicados»):
 *   · `anio`      — un año (`2026`); sin él, todos.
 *   · `resultado` — `ahorro` (ahorro ≥ 0) o `perdida` (< 0); sin él, todos.
 *   · `facturado` — `1`: los ingresos, solo los facturados.
 *   · `tipo`      — `ingresos` o `egresos`: el reporte de un solo lado (Fernando, 2026-10-30).
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
    // `facturado=1`: los ingresos cuentan solo lo facturado (ver SQL_INGRESO_FACTURADO); los
    // egresos, solo los del SRI (sin adicionales). El ahorro y el filtro de resultado se calculan con ese ingreso.
    const soloFacturado = q.get('facturado') === '1';
    const tipo = q.get('tipo') === 'ingresos' || q.get('tipo') === 'egresos' ? (q.get('tipo') as 'ingresos' | 'egresos') : null;

    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (anio) { params.push(anio); condiciones.push(`year = $${params.length}`); }
    // El resultado del mes se decide DESPUÉS, con el ingreso que toque (todo o solo facturado).
    const { rows: monthRows } = await pool.query(
      `SELECT * FROM gcc_world.finance_months ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''} ORDER BY year DESC, month DESC`,
      params,
    );

    const months = [];
    for (const m of monthRows) {
      const { rows: items } = await pool.query(
        `SELECT fi.*, ${SQL_INGRESO_FACTURADO} AS facturado FROM gcc_world.finance_items fi WHERE fi.month_id = $1 ORDER BY fi.type, fi.sort_order, fi.id`, [m.id]
      );
      const ingresos = items.filter((i: any) => i.type === 'income' && (!soloFacturado || i.facturado));
      // Con «solo facturado», lo del SRI y nada más: fuera también los egresos adicionales.
      const egresos = items.filter((i: any) => i.type === 'expense' && (!soloFacturado || !i.adicional));
      const totalIncome = ingresos.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
      const totalExpense = egresos.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
      const totalSavings = totalIncome - totalExpense;
      if (resultado === 'ahorro' && totalSavings < 0) continue;
      if (resultado === 'perdida' && totalSavings >= 0) continue;
      months.push({
        year: m.year,
        month: m.month,
        monthName: MONTH_NAMES[m.month - 1],
        totalIncome,
        totalExpense,
        totalSavings,
        incomeItems: ingresos.map(renglonPdf),
        expenseItems: egresos.map(renglonPdf),
      });
    }

    const partes = [tipo === 'ingresos' ? 'solo ingresos' : tipo === 'egresos' ? 'solo egresos' : null, anio ? String(anio) : null, soloFacturado ? 'solo facturado' : null, resultado === 'ahorro' ? 'meses con ahorro' : resultado === 'perdida' ? 'meses con pérdida' : null].filter(Boolean);
    const subtitulo = partes.length ? partes.map((p) => String(p).charAt(0).toUpperCase() + String(p).slice(1)).join(' · ') : 'Global · todos los meses';
    const archivo = ['Reporte-Financiero', ...(partes.length ? partes : ['Global'])].join('-').replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const pdfBuffer = await generateFinancePdf(months, tipo === 'ingresos' ? 'Reporte de ingresos' : tipo === 'egresos' ? 'Reporte de egresos' : 'Reporte financiero', { subtitulo, solo: tipo ?? undefined });

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
