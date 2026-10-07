import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { addTicketIncomeToFinance } from '@/lib/finance';
import { ensureTicketSlotColumns, ensureTicketActionColumns } from '@/lib/tickets/schema';
import { findOrCreatePlaceholderByEmail, resolveMemberId } from '@/lib/clients/account';
import { puedeVerTicket, puedeEditarTicket, puedeBorrarTicket, cargarTicketParaPermiso } from '@/lib/tickets/permisos';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensureTicketSlotColumns();
    await ensureTicketActionColumns();
    const { rows } = await pool.query(
      `SELECT t.*, c.name as client_name, c.email as client_email,
              c.phone as client_phone, c.ruc as client_ruc, c.address as client_address,
              m.name as member_name, s.name as service_name, s.base_price as service_base_price,
              (SELECT json_agg(ts ORDER BY ts.date) FROM gcc_world.ticket_time_slots ts WHERE ts.ticket_id = t.id) as time_slots,
              (SELECT json_agg(ta ORDER BY ta.work_date NULLS LAST, ta.created_at) FROM gcc_world.ticket_actions ta WHERE ta.ticket_id = t.id) as actions,
              (SELECT COALESCE(SUM(cost), 0) FROM gcc_world.ticket_actions WHERE ticket_id = t.id) as actions_total,
              (SELECT COALESCE(SUM(duration_seconds), 0) FROM gcc_world.ticket_actions WHERE ticket_id = t.id) as actions_seconds
       FROM gcc_world.tickets t
       LEFT JOIN gcc_world.clients c ON c.id = t.client_id
       LEFT JOIN gcc_world.members m ON m.id = t.member_id
       LEFT JOIN gcc_world.services s ON s.id = t.service_id
       WHERE t.id = $1`,
      [id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Quien no puede verlo no sabe ni que existe (`lib/tickets/permisos.ts`).
    if (!(await puedeVerTicket(user, rows[0]))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Ticket GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    /**
     * BORRADORES (2026-10-07):
     *  · solo quien lo creó (o el admin) lo toca;
     *  · de 'draft' se sale ENVIANDO (`/enviar`), no cambiando el estado aquí: enviar es lo
     *    que avisa al cliente, y saltárselo dejaría un ticket «pendiente» que nadie conoce;
     *  · nada vuelve a 'draft' por aquí;
     *  · el cliente por correo de un borrador se guarda como correo, sin dar de alta a nadie;
     *  · `si_no_cambio_desde` (la `updated_at` que conocía quien edita): si alguien lo cambió
     *    después, 409 con la versión actual — lo editado sin conexión no pisa en silencio.
     */
    const { rows: [actual] } = await pool.query(
      `SELECT id, status, user_id, member_id, client_id, open_for_proposals, open_for_talent, updated_at
         FROM gcc_world.tickets WHERE id = $1`, [id],
    );
    if (!actual) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const esBorrador = actual.status === 'draft';
    if (!(await puedeEditarTicket(user, actual))) {
      return NextResponse.json({ error: (await puedeVerTicket(user, actual)) ? 'No autorizado' : 'Not found' },
        { status: (await puedeVerTicket(user, actual)) ? 403 : 404 });
    }
    // «Completado» registra el ingreso en finanzas: por esta vía, solo el administrador.
    if (body.status === 'completed' && actual.status !== 'completed' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo un administrador completa un ticket desde aquí' }, { status: 403 });
    }
    if (body.status !== undefined && body.status !== actual.status && (esBorrador || body.status === 'draft')) {
      return NextResponse.json({ error: esBorrador ? 'Un borrador se envía con «Enviar», no cambiando el estado' : 'Un ticket no vuelve a borrador' }, { status: 400 });
    }
    if (body.si_no_cambio_desde && new Date(body.si_no_cambio_desde).getTime() !== new Date(actual.updated_at).getTime()) {
      const { rows: [ahora] } = await pool.query(`SELECT * FROM gcc_world.tickets WHERE id = $1`, [id]);
      return NextResponse.json({ error: 'Este borrador cambió en otro sitio', conflicto: true, data: ahora }, { status: 409 });
    }
    if (esBorrador && body.client_email !== undefined && !body.client_id) {
      body.draft_client_email = String(body.client_email || '').trim().toLowerCase() || null;
      delete body.client_email;
    }
    if (esBorrador && body.client_id) body.draft_client_email = null;

    // Cliente por CORREO nuevo: se resuelve a un placeholder inactivo (ligado al creador) y se
    // usa como client_id. Así editar un ticket puede asignar un cliente nuevo por correo.
    if (body.client_email && String(body.client_email).trim() && !body.client_id) {
      const createdBy = await resolveMemberId(user.userId);
      const ph = await findOrCreatePlaceholderByEmail(String(body.client_email).trim(), createdBy);
      if (ph) body.client_id = ph.id;
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(body)) {
      if (['title', 'description', 'status', 'member_id', 'client_id', 'service_id', 'deadline', 'estimated_hours', 'estimated_cost', 'cancellation_reason',
           ...(esBorrador ? ['draft_client_email', 'required_talents'] : [])].includes(key)) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE gcc_world.tickets SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Auto-register as income when ticket is completed
    const ticket = rows[0];
    if (ticket.status === 'completed' && ticket.estimated_cost) {
      try {
        await addTicketIncomeToFinance(String(ticket.id), ticket.title, Number(ticket.estimated_cost) || 0);
      } catch (finErr: any) { console.error('Finance ticket registration error:', finErr.message); }
    }

    // (Eliminado 2026-07-27) Cerrar un ticket abría una etapa del juego viejo
    // (`evaluateStages`, regla 'primer-ticket'). Ese sistema de etapas era del
    // mundo web que sustituye Godot y se fue con él. Cuando el juego vuelva a
    // tener progresión, se decidirá desde Godot qué hechos la desbloquean.

    return NextResponse.json({ data: ticket });
  } catch (err: any) {
    console.error('Ticket PATCH error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const t = await cargarTicketParaPermiso(id);
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!puedeBorrarTicket(user, t)) {
      return NextResponse.json({ error: 'Solo un administrador borra un ticket' }, { status: 403 });
    }
    await pool.query('DELETE FROM gcc_world.tickets WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error('Ticket DELETE error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
