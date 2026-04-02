import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { generateFinancePdf } from '@/lib/finance-pdf';
import { ensureFinanceTables } from '@/lib/finance';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await ensureFinanceTables();

    const { rows: monthRows } = await pool.query(
      `SELECT * FROM gcc_world.finance_months ORDER BY year DESC, month DESC`
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

    const pdfBuffer = await generateFinancePdf(months, 'Reporte Financiero Global');

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Reporte-Financiero-Global.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
