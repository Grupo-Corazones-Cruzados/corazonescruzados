import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { validateQuoteToken } from '@/lib/cotizaciones/schema';
import { applyQuoteChange } from '@/lib/cotizaciones/data';
import { chatQuote, cotizadorConfigured, COTIZADOR_MODEL } from '@/lib/cotizaciones/worker';

/**
 * Chat público "GCC Bot" para el cliente externo (por token). Puede pedir cambios; si el
 * agente reformula la cotización, se re-materializa y versiona. Es la ÚNICA vía por la que el
 * externo modifica la cotización (la interfaz pública es solo lectura).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!cotizadorConfigured()) return NextResponse.json({ error: 'El agente no está disponible por ahora.' }, { status: 503 });
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const token = String(body.token || '');
    const message = String(body.message || '').trim();
    if (!message) return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    const p = await validateQuoteToken(id, token);
    if (p.quote_status === 'accepted') return NextResponse.json({ error: 'La cotización ya fue aceptada; no admite cambios.' }, { status: 400 });

    const { rows: [s] } = await pool.query(
      `SELECT worker_session_id, service_id, service_name, service_rate, detail, instructions FROM gcc_world.quote_sessions WHERE project_id = $1`, [id]);
    const budgetNote = p.quote_client_budget != null ? `\n\nPRESUPUESTO DEL CLIENTE: $${Number(p.quote_client_budget)} — ajusta la cotización a este presupuesto en lo posible.` : '';
    const context = {
      memberId: p.assigned_member_id ? Number(p.assigned_member_id) : null, userId: 'external',
      service: { id: s?.service_id ? Number(s.service_id) : null, name: s?.service_name || '', rate: s?.service_rate != null ? Number(s.service_rate) : null },
      detail: s?.detail || '', instructions: (s?.instructions || '') + budgetNote,
    };
    const out = await chatQuote({ sessionId: s?.worker_session_id || '', message, model: COTIZADOR_MODEL, context });

    if (out.sessionId && out.sessionId !== s?.worker_session_id) {
      await pool.query(`UPDATE gcc_world.quote_sessions SET worker_session_id = $1, updated_at = NOW() WHERE project_id = $2`, [out.sessionId, id]);
    }

    let changed = false;
    let version: number | null = null;
    if (out.payload && out.payload.requirements.length) {
      changed = true;
      const r = await applyQuoteChange(id, out.payload, 'Cambio solicitado por el cliente (chat)', 'external');
      version = r.version;
    }
    return NextResponse.json({ data: { reply: out.reply, changed, version } });
  } catch (err: any) {
    console.error('Public quote chat error:', err.message);
    return NextResponse.json({ error: err.message || 'Error' }, { status: err.status || 500 });
  }
}
