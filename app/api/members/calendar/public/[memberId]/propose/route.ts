import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { findOverlappingInstances, type OverlapCandidate } from '@/lib/calendar/overlap';
import { sendProposalReceivedToMember } from '@/lib/integrations/resend';
import { ensureCalendarGuestColumns } from '@/lib/calendar/guest';
import type { CalendarEvent } from '@/lib/calendar/recurrence';

type RouteCtx = { params: Promise<{ memberId: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest, ctx: RouteCtx) {
  try {
    const { memberId } = await ctx.params;

    const body = await req.json();
    const token = String(body.token || '').trim();
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 });

    // Visitante externo/anónimo: se identifica solo con su correo (sin cuenta).
    const guestEmail = String(body.guest_email || '').trim().toLowerCase();
    const guestName = String(body.guest_name || '').trim();
    if (!EMAIL_RE.test(guestEmail)) {
      return NextResponse.json({ error: 'Ingresa un correo electrónico válido' }, { status: 400 });
    }

    const memberRes = await pool.query(
      `SELECT m.id, m.name, m.email, m.calendar_public_token
         FROM gcc_world.members m
        WHERE m.id = $1 AND m.calendar_public_token = $2 LIMIT 1`,
      [memberId, token],
    );
    const member = memberRes.rows[0];
    if (!member) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 });

    const validationError = validateProposalPayload(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    await ensureCalendarGuestColumns();

    const candidate: OverlapCandidate = {
      start_at: body.start_at,
      end_at: body.end_at,
      recurrence_type: body.recurrence_type || 'none',
      recurrence_days: body.recurrence_type === 'weekly' ? (body.recurrence_days || []) : null,
      recurrence_interval: Number(body.recurrence_interval) || 1,
      recurrence_until: body.recurrence_until || null,
    };

    const existingRes = await pool.query(
      `SELECT
         e.id, e.title, e.description, e.event_type, e.client_id,
         NULL::text AS client_name,
         e.start_at, e.end_at, e.all_day, e.timezone,
         e.recurrence_type, e.recurrence_days, e.recurrence_interval, e.recurrence_until,
         e.color, e.status
       FROM gcc_world.member_calendar_events e
       WHERE e.member_id = $1 AND e.status <> 'cancelled'`,
      [memberId],
    );

    const overlap = findOverlappingInstances(
      existingRes.rows as CalendarEvent[],
      candidate,
    );
    if (overlap) {
      return NextResponse.json(
        { error: 'Ese espacio ya está ocupado. Elige otro horario.' },
        { status: 409 },
      );
    }

    const insertRes = await pool.query(
      `INSERT INTO gcc_world.member_calendar_events (
         member_id, title, description, event_type, client_id,
         start_at, end_at, all_day, timezone,
         recurrence_type, recurrence_days, recurrence_interval, recurrence_until,
         color, status, created_by, guest_email, guest_name
       ) VALUES (
         $1, $2, $3, 'progreso', NULL,
         $4, $5, FALSE, $6,
         $7, $8, $9, $10,
         NULL, 'proposed', NULL, $11, $12
       ) RETURNING id, start_at, end_at`,
      [
        memberId,
        body.title,
        body.description || null,
        body.start_at,
        body.end_at,
        body.timezone || 'America/Guayaquil',
        candidate.recurrence_type,
        candidate.recurrence_days,
        candidate.recurrence_interval,
        candidate.recurrence_until,
        guestEmail,
        guestName || null,
      ],
    );

    const created = insertRes.rows[0];
    const clientName = guestName || guestEmail;

    if (member.email) {
      try {
        await sendProposalReceivedToMember({
          memberEmail: member.email,
          memberName: member.name,
          clientName,
          clientEmail: guestEmail,
          eventTitle: body.title,
          eventStart: new Date(created.start_at),
          eventEnd: new Date(created.end_at),
        });
      } catch (err: any) {
        console.error('Propose email error:', err.message);
      }
    }

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (err: any) {
    console.error('Propose POST error:', err.message);
    return NextResponse.json({ error: 'Error al proponer' }, { status: 500 });
  }
}

/**
 * Cancelar una propuesta PROPIA aún pendiente (el visitante externo, sin cuenta, cancela
 * la reserva que acaba de crear en su sesión). Requiere el token del enlace + el id del
 * evento + el correo con el que se creó (solo borra propuestas `proposed` que coincidan).
 */
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  try {
    const { memberId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    const eventId = String(body.eventId || '').trim();
    const guestEmail = String(body.guest_email || '').trim().toLowerCase();
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    if (!eventId || !guestEmail) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });

    const memberRes = await pool.query(
      `SELECT id FROM gcc_world.members WHERE id = $1 AND calendar_public_token = $2 LIMIT 1`,
      [memberId, token],
    );
    if (!memberRes.rows[0]) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 });

    await ensureCalendarGuestColumns();
    const del = await pool.query(
      `DELETE FROM gcc_world.member_calendar_events
        WHERE id = $1 AND member_id = $2 AND status = 'proposed' AND lower(guest_email) = $3`,
      [eventId, memberId, guestEmail],
    );
    if (!del.rowCount) return NextResponse.json({ error: 'No se encontró la reserva para cancelar' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Propose DELETE error:', err.message);
    return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 });
  }
}

function validateProposalPayload(b: any): string | null {
  if (!b || typeof b !== 'object') return 'Payload inválido';
  if (!b.title || !String(b.title).trim()) return 'Título requerido';
  if (!b.start_at || !b.end_at) return 'Fechas requeridas';
  if (new Date(b.end_at).getTime() <= new Date(b.start_at).getTime()) {
    return 'La hora de fin debe ser posterior al inicio';
  }
  if (new Date(b.start_at).getTime() < Date.now() - 60_000) {
    return 'No puedes proponer horarios en el pasado';
  }
  if (b.recurrence_type && !['none', 'weekly'].includes(b.recurrence_type)) {
    return 'Recurrencia no soportada para propuestas (solo única o semanal)';
  }
  if (b.recurrence_type === 'weekly' && (!Array.isArray(b.recurrence_days) || b.recurrence_days.length === 0)) {
    return 'Selecciona al menos un día de la semana';
  }
  return null;
}
