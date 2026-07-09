import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProjectMembersTable, setResponsible } from '@/lib/projects/members';
import { ensureUserClientAccount } from '@/lib/tickets/clientAccount';
import { ensureAdminMember } from '@/lib/ensure-admin-member';
import { sendProjectClientInvitationEmail } from '@/lib/integrations/resend';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    await ensureProjectMembersTable();

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 15);
    const offset = (page - 1) * limit;

    // Access control + search (base for list, count, and per-tab counts).
    // Private projects only visible to owner, invited members, or admin.
    let accessWhere = 'WHERE 1=1';
    const accessParams: any[] = [];
    let mId: number | null = null;
    if (user.role === 'member') {
      const memberRes = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
      mId = memberRes.rows[0]?.member_id ?? null;
      if (mId) {
        accessParams.push(mId);
        const mIdx = accessParams.length;
        accessWhere += ` AND ((p.is_private = false AND p.status != 'draft') OR p.assigned_member_id = $${mIdx} OR EXISTS (SELECT 1 FROM gcc_world.project_bids pb WHERE pb.project_id = p.id AND pb.member_id = $${mIdx}) OR EXISTS (SELECT 1 FROM gcc_world.project_members pm WHERE pm.project_id = p.id AND pm.member_id = $${mIdx}))`;
      }
    } else if (user.role === 'client') {
      const clientRes = await pool.query(`SELECT id FROM gcc_world.clients WHERE LOWER(email) = LOWER($1) LIMIT 1`, [user.email]);
      if (clientRes.rows[0]) {
        accessParams.push(clientRes.rows[0].id);
        accessWhere += ` AND p.client_id = $${accessParams.length}`;
      }
    }
    // admin sees everything
    if (search) {
      accessParams.push(`%${search}%`);
      accessWhere += ` AND p.title ILIKE $${accessParams.length}`;
    }

    // Scope/status filter extends the access base.
    let where = accessWhere;
    const params: any[] = [...accessParams];
    if (status === 'mine' && mId) {
      params.push(mId);
      where += ` AND p.assigned_member_id = $${params.length}`;
    } else if (status === 'invited' && mId) {
      params.push(mId);
      where += ` AND (EXISTS (SELECT 1 FROM gcc_world.project_bids pb2 WHERE pb2.project_id = p.id AND pb2.member_id = $${params.length} AND pb2.status = 'invited') OR EXISTS (SELECT 1 FROM gcc_world.project_members pm2 WHERE pm2.project_id = p.id AND pm2.member_id = $${params.length} AND pm2.role = 'responsible' AND pm2.status = 'invited'))`;
    } else if (status && status !== 'all' && status !== 'mine' && status !== 'invited') {
      params.push(status);
      where += ` AND p.status = $${params.length}`;
    }

    // Per-tab counts for the rail (respect access + search; ignore scope/status filter).
    const counts: Record<string, number> = {};
    const statusCountsQ = await pool.query(
      `SELECT p.status, COUNT(*)::int AS n FROM gcc_world.projects p ${accessWhere} GROUP BY p.status`,
      accessParams,
    );
    let allCount = 0;
    for (const r of statusCountsQ.rows) { counts[r.status] = Number(r.n); allCount += Number(r.n); }
    counts.all = allCount;
    if (user.role === 'member' && mId) {
      const mineQ = await pool.query(
        `SELECT COUNT(*)::int AS n FROM gcc_world.projects p ${accessWhere} AND p.assigned_member_id = $${accessParams.length + 1}`,
        [...accessParams, mId],
      );
      counts.mine = Number(mineQ.rows[0].n);
      const invQ = await pool.query(
        `SELECT COUNT(*)::int AS n FROM gcc_world.projects p ${accessWhere} AND (EXISTS (SELECT 1 FROM gcc_world.project_bids pb2 WHERE pb2.project_id = p.id AND pb2.member_id = $${accessParams.length + 1} AND pb2.status = 'invited') OR EXISTS (SELECT 1 FROM gcc_world.project_members pm2 WHERE pm2.project_id = p.id AND pm2.member_id = $${accessParams.length + 1} AND pm2.role = 'responsible' AND pm2.status = 'invited'))`,
        [...accessParams, mId],
      );
      counts.invited = Number(invQ.rows[0].n);
    } else if (user.role === 'client') {
      counts.mine = allCount;
    }

    const countQ = await pool.query(`SELECT COUNT(*) FROM gcc_world.projects p ${where}`, params);
    params.push(limit, offset);

    // Ensure invoice_projects table exists for the LEFT JOINs
    await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.invoice_projects (
      id SERIAL PRIMARY KEY, invoice_id INT NOT NULL, project_id TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    const dataQ = await pool.query(
      `SELECT p.id, p.title, p.description, p.status, p.is_private,
              p.budget_min, p.budget_max, p.final_cost, p.deadline,
              p.client_id, p.assigned_member_id, p.created_by_user_id,
              p.is_marketplace_published, p.marketplace_source_id,
              p.digimundo_project_id, p.confirmed_at,
              p.created_at, p.updated_at,
              (p.proforma IS NOT NULL) as has_proforma,
              c.name as client_name,
              inv_info.invoice_id,
              inv_info.invoice_sri_status
       FROM gcc_world.projects p
       LEFT JOIN gcc_world.clients c ON c.id = p.client_id
       LEFT JOIN LATERAL (
         SELECT inv_all.invoice_id, inv_all.invoice_sri_status FROM (
           SELECT id as invoice_id, sri_status as invoice_sri_status
           FROM gcc_world.invoices
           WHERE project_id = p.id AND status != 'cancelled'
           UNION ALL
           SELECT ip.invoice_id, i.sri_status
           FROM gcc_world.invoice_projects ip
           JOIN gcc_world.invoices i ON i.id = ip.invoice_id AND i.status != 'cancelled'
           WHERE ip.project_id = CAST(p.id AS TEXT)
         ) inv_all
         ORDER BY CASE inv_all.invoice_sri_status WHEN 'authorized' THEN 0 ELSE 1 END
         LIMIT 1
       ) inv_info ON true
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return NextResponse.json({ data: dataQ.rows, total: Number(countQ.rows[0].count), counts });
  } catch (err: any) {
    console.error('Projects error:', err.message);
    return NextResponse.json({ data: [], total: 0, counts: {} });
  }
}

/**
 * Crea un proyecto en dos modos (paralelo a Tickets):
 *  - mode='create'  ("Nuevo proyecto"): el CREADOR es el RESPONSABLE (candidato/miembro/admin).
 *    Cliente = uno de sus clientes (client_id) o por email (se registra el correo + se envía
 *    invitación; el proyecto queda ligado al correo, no a una cuenta). Estado draft/privado.
 *  - mode='request' ("Solicitar proyecto"): CUALQUIER usuario actúa como CLIENTE automáticamente
 *    (se crea/reutiliza su cuenta cliente). Puede sugerir un miembro como responsable (queda
 *    INVITADO a aceptar el liderazgo) o dejarlo ABIERTO A PROPUESTAS.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    // Self-heal columnas usadas.
    await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS created_by_user_id TEXT`);
    await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS client_email TEXT`);
    await ensureProjectMembersTable();

    const mode: 'create' | 'request' = body.mode === 'request' ? 'request' : 'create';

    // Datos del usuario (member_id, nombre) + flags de rol.
    const uRow = (await pool.query(
      `SELECT member_id, first_name, last_name, email FROM gcc_world.users WHERE id = $1`, [user.userId],
    )).rows[0] || {};
    const userName = [uRow.first_name, uRow.last_name].filter(Boolean).join(' ').trim() || uRow.email || user.email || null;
    const isAdmin = user.role === 'admin';
    const isMember = user.role === 'member';
    const isCandidate = user.role === 'client' && (await pool.query(
      `SELECT 1 FROM gcc_world.clients WHERE user_id = $1 AND account_type = 'candidate' LIMIT 1`, [user.userId],
    )).rows.length > 0;

    let clientId: number | null = null;
    let clientEmail: string | null = null;
    let assignedMemberId: number | null = null;
    let status = 'draft';
    let isPrivate = true;
    let responsibleInviteMemberId: number | null = null;
    let inviteEmailTo: string | null = null;

    if (mode === 'create') {
      // Solo candidato/miembro/admin pueden crear un proyecto propio (ser responsable).
      if (!(isAdmin || isMember || isCandidate)) {
        return NextResponse.json({ error: 'Solo candidatos, miembros o admins pueden crear un proyecto.' }, { status: 403 });
      }
      // El responsable es el propio creador (su perfil de miembro).
      let respId: number | null = uRow.member_id ? Number(uRow.member_id) : null;
      if (!respId && isAdmin) respId = await ensureAdminMember(user.userId, user.email, userName || 'Administrador');
      if (!respId) return NextResponse.json({ error: 'Necesitas un perfil de miembro para ser responsable del proyecto.' }, { status: 400 });
      assignedMemberId = respId;

      // Cliente: de mis clientes (client_id) o por email (se registra el correo).
      if (body.client_id) {
        clientId = Number(body.client_id);
        const c = await pool.query(`SELECT email FROM gcc_world.clients WHERE id = $1`, [clientId]);
        clientEmail = c.rows[0]?.email || null;
      } else if (body.client_email) {
        clientEmail = String(body.client_email).trim().toLowerCase() || null;
        if (clientEmail) {
          // Enlaza a un cliente real existente si lo hay; si no, NO se crea cuenta: se
          // registra solo el correo y se envía invitación a unirse al sistema.
          const ex = await pool.query(`SELECT id FROM gcc_world.clients WHERE LOWER(email) = $1 LIMIT 1`, [clientEmail]);
          if (ex.rows[0]) clientId = Number(ex.rows[0].id);
          else inviteEmailTo = clientEmail;
        }
      }
      status = 'draft'; isPrivate = true;
    } else {
      // request: el usuario es el CLIENTE (cuenta cliente automática, como en tickets).
      clientId = await ensureUserClientAccount(user.userId);
      clientEmail = (uRow.email || user.email || '').toLowerCase() || null;
      if (body.open_for_proposals) {
        status = 'open'; isPrivate = false; // abierto a propuestas: visible para que miembros oferten
      } else if (body.member_id) {
        responsibleInviteMemberId = Number(body.member_id); // sugerido: queda INVITADO a aceptar
        status = 'open'; isPrivate = true;                  // privado: solo el invitado + admin
      } else {
        status = 'open'; isPrivate = false; // sin elección → abierto a propuestas por defecto
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.projects (client_id, client_email, assigned_member_id, title, description, budget_min, budget_max, deadline, status, is_private, final_cost, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [clientId, clientEmail, assignedMemberId, body.title, body.description || null, body.budget_min || null, body.budget_max || null, body.deadline || null, status, isPrivate, body.final_cost || null, user.userId],
    );
    const project = rows[0];

    // Membresías de proyecto (responsable / participante).
    if (mode === 'create' && assignedMemberId) {
      await setResponsible(project.id, assignedMemberId, { invited: false });
    } else if (responsibleInviteMemberId) {
      await setResponsible(project.id, responsibleInviteMemberId, { invited: true });
    }

    // Invitación por email al cliente que aún no está en el sistema (best-effort).
    if (inviteEmailTo) {
      try { await sendProjectClientInvitationEmail({ email: inviteEmailTo, projectTitle: body.title, inviterName: userName }); }
      catch (e) { console.error('Project client invite email failed:', e); }
    }

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (err: any) {
    console.error('Projects POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
