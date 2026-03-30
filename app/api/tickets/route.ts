import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || '');
  return _resend;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 15);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      where += ` AND t.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND t.title ILIKE $${params.length}`;
    }
    if (user.role === 'client') {
      params.push(user.userId);
      where += ` AND t.client_id IN (SELECT id FROM gcc_world.clients WHERE user_id = $${params.length})`;
    }

    const countQ = await pool.query(`SELECT COUNT(*) FROM gcc_world.tickets t ${where}`, params);
    params.push(limit, offset);
    const dataQ = await pool.query(
      `SELECT t.*, c.name as client_name, m.name as member_name
       FROM gcc_world.tickets t
       LEFT JOIN gcc_world.clients c ON c.id = t.client_id
       LEFT JOIN gcc_world.members m ON m.id = t.member_id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return NextResponse.json({ data: dataQ.rows, total: Number(countQ.rows[0].count) });
  } catch (err: any) {
    console.error('Tickets error:', err.message);
    return NextResponse.json({ data: [], total: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { title, description, service_id, member_id, client_id, client_email, deadline, estimated_hours, estimated_cost, time_slots } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'El titulo es requerido' }, { status: 400 });
    }

    // If user is a client, resolve their client_id automatically
    let resolvedClientId = client_id || null;
    if (user.role === 'client' && !resolvedClientId) {
      const clientRes = await pool.query(
        `SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`,
        [user.userId]
      );
      if (clientRes.rows.length > 0) resolvedClientId = clientRes.rows[0].id;
    }

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.tickets (title, description, service_id, member_id, client_id, deadline, estimated_hours, estimated_cost, status, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, NOW(), NOW())
       RETURNING *`,
      [
        title.trim(),
        description?.trim() || null,
        service_id || null,
        member_id || null,
        resolvedClientId,
        deadline || null,
        estimated_hours || null,
        estimated_cost || null,
        user.userId,
      ]
    );

    const ticket = rows[0];

    // Insert time slots if provided
    if (Array.isArray(time_slots) && time_slots.length > 0) {
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
    if (client_email?.trim()) {
      try {
        const ticketUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.grupocc.org'}/dashboard/tickets/${ticket.id}`;
        await getResend().emails.send({
          from: process.env.EMAIL_FROM || 'GCC World <noreply@gccworld.com>',
          to: client_email.trim(),
          bcc: 'lfgonzalezm0@grupocc.org',
          subject: `Nuevo Ticket #${ticket.id}: ${title} — GCC World`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;padding:0;margin:0;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="height:6px;background:#4B2D8E;"></div>
  <div style="padding:30px 40px;">
    <h1 style="color:#1a1a2e;font-size:22px;margin:0 0 6px;">Nuevo Ticket Creado</h1>
    <p style="color:#888;font-size:14px;margin:0 0 24px;">Se ha registrado un nuevo ticket de servicio a tu nombre.</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
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
