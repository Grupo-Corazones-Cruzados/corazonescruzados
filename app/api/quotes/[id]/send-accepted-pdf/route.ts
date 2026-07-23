import { NextRequest, NextResponse } from 'next/server';
import { checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { pool } from '@/lib/db';
import { loadQuote } from '@/lib/cotizaciones/data';
import { renderQuotePdf } from '@/lib/cotizaciones/pdf';
import { sendAcceptedQuoteToClient } from '@/lib/integrations/email';

/**
 * (Re)genera el PDF de una cotización ACEPTADA y lo envía por correo al cliente. Pensado para
 * reenviar el documento o cubrir cotizaciones aceptadas antes de que existiera el envío
 * automático. Autorizado por admin (sesión) o por `x-cron-token`. El destinatario por defecto
 * es `quote_client_email`; se puede sobreescribir con `{ email }` en el cuerpo.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viaCron = checkCronToken(req);
  if (!viaCron) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json().catch(() => ({}));

    const { rows: [p] } = await pool.query(
      `SELECT quote_client_email, quote_status FROM gcc_world.projects WHERE id = $1`, [id]);
    if (!p) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });

    const email = String(body.email || p.quote_client_email || '').trim();
    if (!email) return NextResponse.json({ error: 'No hay correo de cliente para esta cotización' }, { status: 400 });

    const q = await loadQuote(id);
    if (!q) return NextResponse.json({ error: 'No se pudo cargar la cotización' }, { status: 404 });

    const pdf = await renderQuotePdf({ ...q, quoteDecidedAt: new Date() });
    await sendAcceptedQuoteToClient({
      email,
      projectTitle: q.title || `Cotización #${id}`,
      total: q.total || 0,
      responsibleName: q.responsibleName,
      pdf,
    });

    return NextResponse.json({ ok: true, sentTo: email, total: q.total || 0 });
  } catch (err: any) {
    console.error('send-accepted-pdf:', err.message);
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}
