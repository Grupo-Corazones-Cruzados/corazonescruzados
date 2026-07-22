import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureQuoteTables, type QuotePayload } from '@/lib/cotizaciones/schema';
import { chatQuote, cotizadorConfigured, COTIZADOR_MODEL } from '@/lib/cotizaciones/worker';

/** Rehace los requerimientos + subtareas del proyecto a partir de un payload nuevo. */
async function materialize(projectId: number, payload: QuotePayload): Promise<number> {
  const { rows: existing } = await pool.query(`SELECT id FROM gcc_world.project_requirements WHERE project_id = $1`, [projectId]);
  for (const r of existing) {
    await pool.query(`DELETE FROM gcc_world.requirement_items WHERE requirement_id = $1`, [r.id]);
    await pool.query(`DELETE FROM gcc_world.requirement_assignments WHERE requirement_id = $1`, [r.id]);
  }
  await pool.query(`DELETE FROM gcc_world.project_requirements WHERE project_id = $1`, [projectId]);
  let total = 0;
  for (const r of payload.requirements) {
    total += Number(r.cost) || 0;
    const { rows: [reqRow] } = await pool.query(
      `INSERT INTO gcc_world.project_requirements (project_id, title, description, cost) VALUES ($1, $2, $3, $4) RETURNING id`,
      [projectId, r.title.slice(0, 300), r.description || null, Number(r.cost) || 0],
    );
    let order = 0;
    for (const st of r.subtasks) {
      await pool.query(`INSERT INTO gcc_world.requirement_items (requirement_id, title, sort_order) VALUES ($1, $2, $3)`, [reqRow.id, String(st).slice(0, 300), order++]);
    }
  }
  return total;
}

/**
 * Chat "GCC Bot" sobre una cotización: reanuda la sesión del agente y, si reformula la
 * cotización, la re-materializa y crea una versión nueva en el historial.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!cotizadorConfigured()) return NextResponse.json({ error: 'El agente de cotizaciones no está configurado.' }, { status: 503 });

    const { id: idStr } = await params;
    const id = Number(idStr);
    const message = String((await req.json()).message || '').trim();
    if (!message) return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });

    await ensureQuoteTables();
    const { rows: [proj] } = await pool.query(
      `SELECT p.id, p.status, p.assigned_member_id, p.created_by_user_id, p.quote_client_budget,
              s.worker_session_id, s.service_id, s.service_name, s.service_rate, s.detail, s.instructions
         FROM gcc_world.projects p
         LEFT JOIN gcc_world.quote_sessions s ON s.project_id = p.id
        WHERE p.id = $1`, [id]);
    if (!proj) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    if (proj.status !== 'cotizacion') return NextResponse.json({ error: 'El proyecto ya no es una cotización' }, { status: 400 });

    // Permiso: responsable (member) o admin. (El acceso externo por token es Fase 2.)
    const uRow = (await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId])).rows[0] || {};
    const isOwner = user.role === 'admin' || (uRow.member_id && Number(uRow.member_id) === Number(proj.assigned_member_id)) || proj.created_by_user_id === user.userId;
    if (!isOwner) return NextResponse.json({ error: 'No tienes acceso a esta cotización' }, { status: 403 });

    const memberId = proj.assigned_member_id ? Number(proj.assigned_member_id) : null;
    const budgetNote = proj.quote_client_budget != null ? `\n\nPRESUPUESTO DEL CLIENTE: $${Number(proj.quote_client_budget)} — ajusta la cotización a este presupuesto en lo posible.` : '';
    const context = {
      memberId, userId: user.userId,
      service: { id: proj.service_id ? Number(proj.service_id) : null, name: proj.service_name || '', rate: proj.service_rate != null ? Number(proj.service_rate) : null },
      detail: proj.detail || '', instructions: (proj.instructions || '') + budgetNote,
    };

    const out = await chatQuote({ sessionId: proj.worker_session_id || '', message, model: COTIZADOR_MODEL, context });

    // Guarda la sesión (por si el worker devolvió una distinta).
    if (out.sessionId && out.sessionId !== proj.worker_session_id) {
      await pool.query(`UPDATE gcc_world.quote_sessions SET worker_session_id = $1, updated_at = NOW() WHERE project_id = $2`, [out.sessionId, id]);
    }

    let changed = false;
    let version: number | null = null;
    if (out.payload && out.payload.requirements.length) {
      changed = true;
      const total = await materialize(id, out.payload);
      const { rows: [vr] } = await pool.query(`SELECT COALESCE(MAX(version), 0) + 1 AS next FROM gcc_world.quote_versions WHERE project_id = $1`, [id]);
      version = Number(vr.next);
      await pool.query(
        `INSERT INTO gcc_world.quote_versions (project_id, version, payload, note, created_by) VALUES ($1, $2, $3, $4, $5)`,
        [id, version, JSON.stringify(out.payload), 'Cambio solicitado por chat', user.userId],
      );
      await pool.query(
        `UPDATE gcc_world.projects SET title = COALESCE($2, title), description = $3, deadline = $4, final_cost = $5, updated_at = NOW() WHERE id = $1`,
        [id, out.payload.title ? out.payload.title.slice(0, 200) : null, out.payload.summary || null, out.payload.deadline || null, total || null],
      );
    }

    return NextResponse.json({ data: { reply: out.reply, changed, version } });
  } catch (err: any) {
    console.error('Quote chat error:', err.message);
    return NextResponse.json({ error: err.message || 'Error en el chat de la cotización' }, { status: 500 });
  }
}
