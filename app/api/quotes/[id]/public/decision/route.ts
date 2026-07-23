import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { validateQuoteToken } from '@/lib/cotizaciones/schema';
import { loadQuote } from '@/lib/cotizaciones/data';
import { createNotification } from '@/lib/notifications';
import { sendQuoteDecisionToResponsible, sendAcceptedQuoteToClient } from '@/lib/integrations/email';
import { renderQuotePdf } from '@/lib/cotizaciones/pdf';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org';

/**
 * El cliente externo ACEPTA o RECHAZA la cotización (por token). Aceptar → la cotización pasa
 * a **borrador** (`draft`), y a partir de ahí sigue la gestión normal del proyecto; rechazar →
 * queda como cotización marcada 'rejected' para que el responsable la ajuste y vuelva a
 * compartir. Notifica al responsable (in-app + correo).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const token = String(body.token || '');
    const action = body.action === 'accept' ? 'accept' : body.action === 'reject' ? 'reject' : null;
    if (!action) return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    const p = await validateQuoteToken(id, token);
    if (p.quote_status === 'accepted') return NextResponse.json({ error: 'La cotización ya fue aceptada' }, { status: 400 });

    const accepted = action === 'accept';
    if (accepted) {
      // Aceptada → pasa a BORRADOR y se fija el PRESUPUESTO del proyecto = total cotizado.
      const q = await loadQuote(id);
      const total = q?.total || 0;
      await pool.query(
        `UPDATE gcc_world.projects SET quote_status = 'accepted', quote_decided_at = NOW(), status = 'draft',
            budget_min = $2, budget_max = $2, updated_at = NOW() WHERE id = $1`, [id, total || null]);
    } else {
      await pool.query(
        `UPDATE gcc_world.projects SET quote_status = 'rejected', quote_decided_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    }

    // Notifica al responsable (miembro) del proyecto.
    try {
      const q = await loadQuote(id);
      const { rows: [u] } = await pool.query(
        `SELECT u.id, u.email, u.first_name FROM gcc_world.users u WHERE u.member_id = $1 ORDER BY u.created_at LIMIT 1`,
        [p.assigned_member_id],
      );
      const link = `${APP_URL}/dashboard/projects/${id}`;
      if (u?.id) {
        await createNotification(u.id, {
          type: 'quote_decided',
          title: accepted ? `Cotización aceptada: ${q?.title || '#' + id}` : `Cotización rechazada: ${q?.title || '#' + id}`,
          message: accepted ? 'El cliente aceptó la cotización.' : 'El cliente rechazó la cotización.',
          link,
        });
      }
      if (u?.email) {
        await sendQuoteDecisionToResponsible({
          email: u.email, name: u.first_name, projectTitle: q?.title || `Cotización #${id}`,
          action: accepted ? 'accepted' : 'rejected', clientEmail: p.quote_client_email || undefined, url: link,
        });
      }
    } catch (e: any) { console.error('quote decision notify:', e.message); }

    // Al ACEPTAR: enviar al cliente (correo al que se le compartió) el PDF con toda la
    // cotización aceptada. Best-effort: no bloquea la aceptación si falla el PDF/correo.
    if (accepted && p.quote_client_email) {
      try {
        const q2 = await loadQuote(id);
        if (q2) {
          const pdf = await renderQuotePdf({ ...q2, quoteDecidedAt: new Date() });
          await sendAcceptedQuoteToClient({
            email: p.quote_client_email,
            projectTitle: q2.title || `Cotización #${id}`,
            total: q2.total || 0,
            responsibleName: q2.responsibleName,
            pdf,
          });
        }
      } catch (e: any) { console.error('accepted quote PDF to client:', e.message); }
    }

    return NextResponse.json({ data: { quoteStatus: accepted ? 'accepted' : 'rejected' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: err.status || 500 });
  }
}
