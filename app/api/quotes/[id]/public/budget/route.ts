import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { validateQuoteToken } from '@/lib/cotizaciones/schema';
import { loadQuote } from '@/lib/cotizaciones/data';
import { createNotification } from '@/lib/notifications';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org';

/**
 * El cliente externo indica el PRESUPUESTO que tiene para el proyecto (por token). NO cambia
 * el estado de la cotización: solo guarda el monto y notifica al responsable (con enlace al
 * proyecto) para que ajuste la cotización a ese presupuesto.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const token = String(body.token || '');
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: 'Ingresa un monto válido' }, { status: 400 });
    const p = await validateQuoteToken(id, token);

    await pool.query(`UPDATE gcc_world.projects SET quote_client_budget = $1, updated_at = NOW() WHERE id = $2`, [amount, id]);

    // Notifica al responsable con enlace rápido al proyecto.
    try {
      const q = await loadQuote(id);
      const { rows: [u] } = await pool.query(
        `SELECT id FROM gcc_world.users WHERE member_id = $1 ORDER BY created_at LIMIT 1`, [p.assigned_member_id]);
      if (u?.id) {
        await createNotification(u.id, {
          type: 'quote_budget',
          title: `Presupuesto del cliente: ${q?.title || '#' + id}`,
          message: `El cliente indicó un presupuesto de $${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Ajusta la cotización si aplica.`,
          link: `${APP_URL}/dashboard/projects/${id}`,
        });
      }
    } catch (e: any) { console.error('quote budget notify:', e.message); }

    return NextResponse.json({ data: { budget: amount } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: err.status || 500 });
  }
}
