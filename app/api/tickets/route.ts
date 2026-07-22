import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { ensureUserClientAccount } from '@/lib/tickets/clientAccount';
import { findOrCreatePlaceholderByEmail, resolveMemberId } from '@/lib/clients/account';
import { createNotification } from '@/lib/notifications';
import { NextRequest, NextResponse } from 'next/server';
import { sendViaGmail } from '@/lib/integrations/google-workspace';


export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const openMode = searchParams.get('open') === '1'; // pestaña "Abiertos" (open_for_proposals)
    const search = searchParams.get('search');
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 15);
    const offset = (page - 1) * limit;

    // Base filters (search + client scoping), shared by list, count and per-status counts.
    let baseWhere = 'WHERE 1=1';
    const baseParams: any[] = [];
    if (search) {
      baseParams.push(`%${search}%`);
      baseWhere += ` AND t.title ILIKE $${baseParams.length}`;
    }
    // En la pestaña "Abiertos" el scoping por cliente NO aplica (candidatos/miembros ven todos).
    if (user.role === 'client' && !openMode) {
      baseParams.push(user.userId);
      baseWhere += ` AND t.client_id IN (SELECT id FROM gcc_world.clients WHERE user_id = $${baseParams.length})`;
    }

    // "Abierto" = a propuestas (todos) o por talento (solo miembro/admin, sin params → seguro inline).
    const openCond = (user.role === 'admin' || user.role === 'member')
      ? `(t.open_for_proposals = true OR t.open_for_talent = true)`
      : `t.open_for_proposals = true`;

    // Status-filtered where extends the base.
    let where = baseWhere;
    const params: any[] = [...baseParams];
    if (openMode) {
      where += ` AND ${openCond}`;
    } else if (status && status !== 'all') {
      params.push(status);
      where += ` AND t.status = $${params.length}`;
    }

    // Ensure invoice source columns exist for the invoice LEFT JOIN (additive, safe)
    await pool.query(`
      ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);
      ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS source_id TEXT;
    `);
    // Columnas de "abierto por talento".
    await pool.query(`ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS open_for_talent BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS required_talents TEXT[] DEFAULT '{}'`);

    // Per-status counts (respect base filters, ignore the status filter) for the rail.
    const countsQ = await pool.query(
      `SELECT t.status, COUNT(*)::int AS n FROM gcc_world.tickets t ${baseWhere} GROUP BY t.status`,
      baseParams,
    );
    const counts: Record<string, number> = {};
    let allCount = 0;
    for (const r of countsQ.rows) { counts[r.status] = Number(r.n); allCount += Number(r.n); }
    counts.all = allCount;
    // Conteo de la pestaña "Abiertos".
    const openCountQ = await pool.query(
      `SELECT COUNT(*)::int AS n FROM gcc_world.tickets t ${baseWhere} AND ${openCond}`,
      baseParams,
    );
    counts.open = Number(openCountQ.rows[0].n);

    const countQ = await pool.query(`SELECT COUNT(*) FROM gcc_world.tickets t ${where}`, params);
    params.push(limit, offset);
    const dataQ = await pool.query(
      `SELECT t.*, COALESCE(c.name, inv_info.invoice_client_name) as client_name, m.name as member_name,
              inv_info.invoice_id, inv_info.invoice_sri_status, inv_info.invoice_total
       FROM gcc_world.tickets t
       LEFT JOIN gcc_world.clients c ON c.id = t.client_id
       LEFT JOIN gcc_world.members m ON m.id = t.member_id
       LEFT JOIN LATERAL (
         SELECT id as invoice_id, sri_status as invoice_sri_status, original_total_usd as invoice_total, client_name_sri as invoice_client_name
         FROM gcc_world.invoices
         WHERE source_type = 'ticket' AND source_id = CAST(t.id AS TEXT) AND status != 'cancelled'
         ORDER BY CASE sri_status WHEN 'authorized' THEN 0 ELSE 1 END
         LIMIT 1
       ) inv_info ON true
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return NextResponse.json({ data: dataQ.rows, total: Number(countQ.rows[0].count), counts });
  } catch (err: any) {
    console.error('Tickets error:', err.message);
    return NextResponse.json({ data: [], total: 0, counts: {} });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { title, description, service_id, member_id, client_id, client_email, deadline, estimated_hours, estimated_cost, time_slots } = body;
    // mode: 'create' = YO soy el miembro asignado y elijo cliente; 'request' = YO soy el
    // cliente (mi cuenta cliente) y elijo un miembro o dejo el ticket abierto a propuestas.
    const mode: 'create' | 'request' = body.mode === 'request' ? 'request' : 'create';
    const openForProposals = mode === 'request' && body.open_for_proposals === true;
    // Modo "por talento": abierto solo a miembros con el talento requerido (toman de inmediato).
    const openForTalent = mode === 'request' && body.open_for_talent === true;
    const requiredTalents: string[] = openForTalent && Array.isArray(body.required_talents)
      ? body.required_talents.filter((t: any) => typeof t === 'string' && t.trim()) : [];

    if (!title?.trim()) {
      return NextResponse.json({ error: 'El titulo es requerido' }, { status: 400 });
    }
    if (openForTalent && requiredTalents.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos un talento requerido.' }, { status: 400 });
    }

    // Columnas para los modos "abierto" (a propuestas / por talento).
    await pool.query(`ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS open_for_proposals BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS open_for_talent BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS required_talents TEXT[] DEFAULT '{}'`);

    // Miembro asignado: en 'request' abierto (propuestas o talento) no hay miembro (queda null).
    const resolvedMemberId = (openForProposals || openForTalent) ? null : (member_id || null);

    // Resolve client: by ID, by email (find or create), or auto for client role
    let resolvedClientId = client_id || null;
    let resolvedClientEmail = client_email?.trim() || null;

    // En modo SOLICITAR, el cliente es la cuenta de tipo cliente del propio usuario
    // (candidato/miembro/admin) — se crea si no existe.
    if (mode === 'request' && !resolvedClientId) {
      resolvedClientId = await ensureUserClientAccount(user.userId);
      if (resolvedClientId) {
        const { rows: [c] } = await pool.query(`SELECT email FROM gcc_world.clients WHERE id = $1`, [resolvedClientId]);
        resolvedClientEmail = c?.email || resolvedClientEmail;
      }
    }

    if (!resolvedClientId && resolvedClientEmail) {
      // RUTA 3: por correo → reusa el cliente existente o crea un placeholder inactivo,
      // ligado al miembro que lo crea (para "mis clientes").
      const createdBy = await resolveMemberId(user.userId);
      const ph = await findOrCreatePlaceholderByEmail(resolvedClientEmail, createdBy);
      resolvedClientId = ph?.id ?? null;
    } else if (resolvedClientId && !resolvedClientEmail) {
      // Get email from existing client for notification
      const { rows: [c] } = await pool.query(`SELECT email FROM gcc_world.clients WHERE id = $1`, [resolvedClientId]);
      resolvedClientEmail = c?.email || null;
    }

    if (user.role === 'client' && !resolvedClientId) {
      const clientRes = await pool.query(
        `SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`,
        [user.userId]
      );
      if (clientRes.rows.length > 0) resolvedClientId = clientRes.rows[0].id;
    }

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.tickets (title, description, service_id, member_id, client_id, deadline, estimated_hours, estimated_cost, status, user_id, open_for_proposals, open_for_talent, required_talents, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12::text[], NOW(), NOW())
       RETURNING *`,
      [
        title.trim(),
        description?.trim() || null,
        service_id || null,
        resolvedMemberId,
        resolvedClientId,
        deadline || null,
        estimated_hours || null,
        estimated_cost || null,
        user.userId,
        openForProposals,
        openForTalent,
        requiredTalents,
      ]
    );

    const ticket = rows[0];

    // Solicitar ticket con miembro escogido → notificar al miembro (usuario) elegido.
    if (mode === 'request' && resolvedMemberId) {
      try {
        const { rows: [u] } = await pool.query(
          `SELECT id FROM gcc_world.users WHERE member_id = $1 LIMIT 1`, [resolvedMemberId]
        );
        if (u?.id) {
          await createNotification(String(u.id), {
            type: 'ticket_request',
            title: title.trim(),
            message: description?.trim() || 'Te solicitaron atender este ticket.',
            link: `/dashboard/tickets/${ticket.id}`,
          });
        }
      } catch (e) { console.error('No se pudo crear la notificación de solicitud de ticket:', (e as any)?.message); }
    }

    // Insert time slots if provided
    if (Array.isArray(time_slots) && time_slots.length > 0) {
      await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.ticket_time_slots (
        id SERIAL PRIMARY KEY,
        ticket_id INT NOT NULL,
        date DATE NOT NULL,
        start_time TEXT,
        end_time TEXT,
        status VARCHAR(20) DEFAULT 'scheduled',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`);
      for (const slot of time_slots) {
        if (!slot.date) continue;
        await pool.query(
          `INSERT INTO gcc_world.ticket_time_slots (ticket_id, date, start_time, end_time, status, created_at)
           VALUES ($1, $2, $3, $4, 'scheduled', NOW())`,
          [ticket.id, slot.date, slot.start_time || null, slot.end_time || null]
        );
      }
    }

    // Send email notification to client
    if (resolvedClientEmail) {
      try {
        const ticketUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.grupocc.org'}/dashboard/tickets/${ticket.id}`;
        await sendViaGmail({
          from: process.env.EMAIL_FROM || 'GCC World <noreply@gccworld.com>',
          to: resolvedClientEmail,
          bcc: 'lfgonzalezm0@grupocc.org',
          subject: `Nuevo Ticket #${ticket.id}: ${title} — GCC World`,
          html: `<div style="font-family:'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;background:#faf9f8;padding:0;margin:0;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="height:6px;background:#4B2D8E;"></div>
  <div style="padding:30px 40px;">
    <h1 style="color:#1a1a2e;font-size:22px;margin:0 0 6px;">Nuevo Ticket Creado</h1>
    <p style="color:#888;font-size:14px;margin:0 0 24px;">Se ha registrado un nuevo ticket de servicio a tu nombre.</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e1dfdd;border-radius:8px;overflow:hidden;">
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;width:35%"><strong>Ticket:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">#${ticket.id}</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Titulo:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">${title}</td></tr>
      ${description ? `<tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Descripcion:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">${description}</td></tr>` : ''}
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Estado:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">Pendiente</td></tr>
      ${deadline ? `<tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Fecha Limite:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">${new Date(deadline).toLocaleDateString('es-EC')}</td></tr>` : ''}
      ${estimated_cost ? `<tr><td style="padding:10px 16px;color:#666;font-size:13px;"><strong>Costo Estimado:</strong></td><td style="padding:10px 16px;font-size:13px;">$${Number(estimated_cost).toFixed(2)}</td></tr>` : ''}
    </table>
    <div style="text-align:center;margin:24px 0 0;">
      <a href="${ticketUrl}" style="display:inline-block;padding:12px 24px;background:#4B2D8E;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;border-radius:4px;">Ver Ticket</a>
    </div>
    <p style="color:#888;font-size:12px;margin:16px 0 0;text-align:center;">Este correo fue generado automaticamente por GCC World.</p>
  </div>
  <div style="height:3px;background:#4B2D8E;"></div>
</div>
</div>`,
        });
      } catch (emailErr: any) {
        console.error('Error sending ticket email:', emailErr.message);
      }
    }

    return NextResponse.json({ data: ticket }, { status: 201 });
  } catch (err: any) {
    console.error('Ticket create error:', err.message);
    return NextResponse.json({ error: 'Error al crear ticket' }, { status: 500 });
  }
}
