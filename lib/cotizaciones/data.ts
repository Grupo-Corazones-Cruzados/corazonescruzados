import { pool } from '@/lib/db';
import type { QuotePayload } from '@/lib/cotizaciones/schema';

/** Rehace requerimientos + subtareas del proyecto desde un payload. Devuelve el total. */
export async function materializeQuote(projectId: number, payload: QuotePayload): Promise<number> {
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

/** Aplica un cambio de cotización: re-materializa, versiona y actualiza el proyecto. */
export async function applyQuoteChange(projectId: number, payload: QuotePayload, note: string, createdBy: string): Promise<{ total: number; version: number }> {
  const reqTotal = await materializeQuote(projectId, payload);
  const addTotal = (payload.additional_costs || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const total = reqTotal + addTotal;
  const { rows: [vr] } = await pool.query(`SELECT COALESCE(MAX(version), 0) + 1 AS next FROM gcc_world.quote_versions WHERE project_id = $1`, [projectId]);
  const version = Number(vr.next);
  await pool.query(
    `INSERT INTO gcc_world.quote_versions (project_id, version, payload, note, created_by) VALUES ($1, $2, $3, $4, $5)`,
    [projectId, version, JSON.stringify(payload), note, createdBy],
  );
  await pool.query(
    `UPDATE gcc_world.projects SET title = COALESCE($2, title), description = $3, deadline = $4, final_cost = $5, additional_costs = $6::jsonb, updated_at = NOW() WHERE id = $1`,
    [projectId, payload.title ? payload.title.slice(0, 200) : null, payload.summary || null, payload.deadline || null, total || null, JSON.stringify(payload.additional_costs || [])],
  );
  return { total, version };
}

/** Carga la cotización estructurada (para la vista pública y la decisión del cliente). */
export async function loadQuote(projectId: number): Promise<any | null> {
  const { rows: [p] } = await pool.query(
    `SELECT p.id, p.title, p.description, p.deadline, p.final_cost, p.status,
            p.quote_status, p.quote_token_expires_at, p.quote_client_email, p.quote_client_budget,
            p.additional_costs,
            s.service_name, s.service_rate,
            m.name AS responsible_name
       FROM gcc_world.projects p
       LEFT JOIN gcc_world.quote_sessions s ON s.project_id = p.id
       LEFT JOIN gcc_world.members m ON m.id = p.assigned_member_id
      WHERE p.id = $1`, [projectId]);
  if (!p) return null;

  const { rows: reqs } = await pool.query(
    `SELECT r.id, r.title, r.description, r.cost,
            COALESCE(json_agg(json_build_object('title', i.title) ORDER BY i.sort_order) FILTER (WHERE i.id IS NOT NULL), '[]') AS subtasks
       FROM gcc_world.project_requirements r
       LEFT JOIN gcc_world.requirement_items i ON i.requirement_id = r.id
      WHERE r.project_id = $1
      GROUP BY r.id
      ORDER BY r.id`, [projectId]);

  const requirements = reqs.map((r: any) => ({
    id: Number(r.id), title: r.title, description: r.description || '',
    cost: r.cost != null ? Number(r.cost) : 0,
    subtasks: (Array.isArray(r.subtasks) ? r.subtasks : []).map((s: any) => s.title).filter(Boolean),
  }));
  const requirementsSubtotal = requirements.reduce((s: number, r: any) => s + (r.cost || 0), 0);
  const additionalCosts = (Array.isArray(p.additional_costs) ? p.additional_costs : []).map((c: any) => ({
    label: String(c?.label || ''), description: c?.description ? String(c.description) : '', amount: Number(c?.amount) || 0,
  })).filter((c: any) => c.label);
  const additionalTotal = additionalCosts.reduce((s: number, c: any) => s + (c.amount || 0), 0);

  return {
    id: Number(p.id),
    title: p.title,
    summary: p.description || '',
    deadline: p.deadline || null,
    status: p.status,
    quoteStatus: p.quote_status || 'pending',
    expiresAt: p.quote_token_expires_at || null,
    clientEmail: p.quote_client_email || null,
    clientBudget: p.quote_client_budget != null ? Number(p.quote_client_budget) : null,
    responsibleName: p.responsible_name || '',
    service: { name: p.service_name || '', rate: p.service_rate != null ? Number(p.service_rate) : null },
    requirements,
    additionalCosts,
    requirementsSubtotal,
    additionalTotal,
    total: requirementsSubtotal + additionalTotal,
  };
}
