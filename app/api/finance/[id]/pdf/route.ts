import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { generateFinancePdf } from '@/lib/finance-pdf';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { rows: [m] } = await pool.query(`SELECT * FROM gcc_world.finance_months WHERE id = $1`, [id]);
    if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { rows: items } = await pool.query(
      `SELECT * FROM gcc_world.finance_items WHERE month_id = $1 ORDER BY type, sort_order, id`, [id]
    );

    const monthName = MONTH_NAMES[m.month - 1];
    const data = [{
      year: m.year,
      month: m.month,
      monthName,
      totalIncome: Number(m.total_income) || 0,
      totalExpense: Number(m.total_expense) || 0,
      totalSavings: Number(m.total_savings) || 0,
      incomeItems: items.filter((i: any) => i.type === 'income').map((i: any) => ({ description: i.description, amount: Number(i.amount) || 0 })),
      expenseItems: items.filter((i: any) => i.type === 'expense').map((i: any) => ({ description: i.description, amount: Number(i.amount) || 0 })),
    }];

    const pdfBuffer = await generateFinancePdf(data, `Reporte Financiero — ${monthName} ${m.year}`);

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
