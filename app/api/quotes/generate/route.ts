import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProjectMembersTable, setResponsible } from '@/lib/projects/members';
import { ensureAdminMember } from '@/lib/ensure-admin-member';
import { findOrCreatePlaceholderByEmail, resolveMemberId } from '@/lib/clients/account';
import { ensureQuoteTables } from '@/lib/cotizaciones/schema';
import { generateQuote, cotizadorConfigured, COTIZADOR_MODEL } from '@/lib/cotizaciones/worker';

/**
 * Genera una COTIZACIÓN nueva (proyecto en estado `cotizacion`) con el agente de
 * Cotizaciones Software. Solo candidatos/miembros/admin (el creador es el responsable).
 *
 * Flujo: valida (servicio + cliente/correo obligatorio) → llama al worker del agente (Opus) →
 * crea el proyecto (privado, responsable = usuario, cliente elegido) → materializa
 * requerimientos + subtareas + costo + fecha límite → guarda sesión + versión v1.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    if (!cotizadorConfigured()) {
      return NextResponse.json({ error: 'El agente de cotizaciones no está configurado todavía (falta COTIZADOR_WORKER_URL / COTIZADOR_WORKER_TOKEN).' }, { status: 503 });
    }

    const body = await req.json();
    const detail = String(body.detail || '').trim();
    const instructions = String(body.instructions || '').trim();
    const serviceId = body.service_id ? Number(body.service_id) : null;
    const agentKey = String(body.agent_key || 'cotizaciones-software');
    const clientIdIn = body.client_id ? Number(body.client_id) : null;
    const clientEmailIn = body.client_email ? String(body.client_email).trim().toLowerCase() : '';
    if (!detail) return NextResponse.json({ error: 'El detalle de la cotización es requerido.' }, { status: 400 });
    if (!serviceId) return NextResponse.json({ error: 'Selecciona un servicio.' }, { status: 400 });
    if (!clientIdIn && !clientEmailIn) return NextResponse.json({ error: 'Selecciona un cliente o ingresa un correo de cliente.' }, { status: 400 });
    if (clientEmailIn && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmailIn)) return NextResponse.json({ error: 'El correo del cliente no es válido.' }, { status: 400 });

    // Rol: solo candidato/miembro/admin (el creador es responsable → necesita perfil de miembro).
    const uRow = (await pool.query(
      `SELECT member_id, first_name, last_name, email FROM gcc_world.users WHERE id = $1`, [user.userId],
    )).rows[0] || {};
    const userName = [uRow.first_name, uRow.last_name].filter(Boolean).join(' ').trim() || uRow.email || user.email || null;
    const isAdmin = user.role === 'admin';
    const isMember = user.role === 'member';
    const isCandidate = user.role === 'client' && (await pool.query(
      `SELECT 1 FROM gcc_world.clients WHERE user_id = $1 AND account_type = 'candidate' LIMIT 1`, [user.userId],
    )).rows.length > 0;
    if (!(isAdmin || isMember || isCandidate)) {
      return NextResponse.json({ error: 'Solo candidatos y miembros pueden generar cotizaciones.' }, { status: 403 });
    }
    let respId: number | null = uRow.member_id ? Number(uRow.member_id) : null;
    if (!respId && isAdmin) respId = await ensureAdminMember(user.userId, user.email, userName || 'Administrador');
    if (!respId) return NextResponse.json({ error: 'Necesitas un perfil de miembro para ser responsable de la cotización.' }, { status: 400 });

    // Servicio elegido (tarifa/hora = base_price). Debe ser del usuario o global.
    const svc = (await pool.query(
      `SELECT id, name, base_price FROM gcc_world.services WHERE id = $1 AND (member_id = $2 OR member_id IS NULL) LIMIT 1`,
      [serviceId, respId],
    )).rows[0];
    if (!svc) return NextResponse.json({ error: 'Servicio no válido o no asociado a tu cuenta.' }, { status: 400 });
    const service = { id: Number(svc.id), name: String(svc.name), rate: svc.base_price != null ? Number(svc.base_price) : null };

    // 1) Agente: genera la cotización (mantiene sesión viva en el worker).
    const gen = await generateQuote({
      memberId: respId, userId: user.userId,
      service, detail, instructions, model: COTIZADOR_MODEL,
    });
    const payload = gen.payload;
    if (!payload.requirements.length) {
      return NextResponse.json({ error: 'El agente no devolvió requerimientos. Intenta reformular el detalle.' }, { status: 502 });
    }

    // 2) Resuelve el cliente (obligatorio): uno existente o por correo (placeholder inactivo).
    let clientId: number | null = clientIdIn;
    let clientEmail: string | null = null;
    if (clientId) {
      const c = await pool.query(`SELECT email FROM gcc_world.clients WHERE id = $1`, [clientId]);
      clientEmail = c.rows[0]?.email || null;
    } else if (clientEmailIn) {
      clientEmail = clientEmailIn;
      const createdBy = await resolveMemberId(user.userId);
      const ph = await findOrCreatePlaceholderByEmail(clientEmailIn, createdBy);
      if (ph) clientId = ph.id;
    }

    // 3) Crea el proyecto-cotización.
    await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS created_by_user_id TEXT`);
    await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS client_email TEXT`);
    await ensureProjectMembersTable();
    await ensureQuoteTables();
    const title = (payload.title && payload.title.trim()) || `Cotización — ${service.name}`;
    const total = payload.total || 0; // requerimientos + costos adicionales
    const { rows: [project] } = await pool.query(
      `INSERT INTO gcc_world.projects (client_id, client_email, assigned_member_id, title, description, deadline, status, is_private, final_cost, created_by_user_id, additional_costs)
       VALUES ($7, $8, $1, $2, $3, $4, 'cotizacion', true, $5, $6, $9::jsonb) RETURNING *`,
      [respId, title.slice(0, 200), payload.summary || detail, payload.deadline || null, total || null, user.userId, clientId, clientEmail, JSON.stringify(payload.additional_costs || [])],
    );
    await setResponsible(project.id, respId, { invited: false });

    // 3) Materializa requerimientos + subtareas + costo.
    for (const r of payload.requirements) {
      const { rows: [reqRow] } = await pool.query(
        `INSERT INTO gcc_world.project_requirements (project_id, title, description, cost) VALUES ($1, $2, $3, $4) RETURNING id`,
        [project.id, r.title.slice(0, 300), r.description || null, Number(r.cost) || 0],
      );
      let order = 0;
      for (const st of r.subtasks) {
        await pool.query(
          `INSERT INTO gcc_world.requirement_items (requirement_id, title, sort_order) VALUES ($1, $2, $3)`,
          [reqRow.id, String(st).slice(0, 300), order++],
        );
      }
    }

    // 4) Sesión del agente + versión v1.
    await pool.query(
      `INSERT INTO gcc_world.quote_sessions (project_id, agent_key, worker_session_id, model, status, service_id, service_name, service_rate, detail, instructions, created_by)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9, $10)
       ON CONFLICT (project_id) DO UPDATE SET worker_session_id = EXCLUDED.worker_session_id, updated_at = NOW()`,
      [project.id, agentKey, gen.sessionId || null, COTIZADOR_MODEL, service.id, service.name, service.rate, detail, instructions, user.userId],
    );
    await pool.query(
      `INSERT INTO gcc_world.quote_versions (project_id, version, payload, note, created_by)
       VALUES ($1, 1, $2, 'Cotización inicial generada por el agente', $3)
       ON CONFLICT (project_id, version) DO NOTHING`,
      [project.id, JSON.stringify(payload), user.userId],
    );

    return NextResponse.json({ data: { projectId: project.id, total, requirements: payload.requirements.length } }, { status: 201 });
  } catch (err: any) {
    console.error('Quote generate error:', err.message);
    return NextResponse.json({ error: err.message || 'Error al generar la cotización' }, { status: 500 });
  }
}
