import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { findOverlappingInstances, type OverlapCandidate } from '@/lib/calendar/overlap';
import { sendProposalReceivedToMember } from '@/lib/integrations/resend';
import type { CalendarEvent } from '@/lib/calendar/recurrence';

type RouteCtx = { params: Promise<{ memberId: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  try {
    const { memberId } = await ctx.params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión para agendar' }, { status: 401 });
    }

    const body = await req.json();
    const token = String(body.token || '').trim();
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 });

    const memberRes = await pool.query(
      `SELECT m.id, m.name, m.email, m.calendar_public_token
         FROM gcc_world.members m
        WHERE m.id = $1 AND m.calendar_public_token = $2 LIMIT 1`,
      [memberId, token],
    );
    const member = memberRes.rows[0];
    if (!member) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 });

    const userRes = await pool.query(
      `SELECT id, email, first_name, last_name, member_id FROM gcc_world.users WHERE id = $1`,
      [user.userId],
    );
    const userRec = userRes.rows[0];
    if (!userRec || !userRec.email) {
      return NextResponse.json({ error: 'Tu cuenta no tiene correo asociado' }, { status: 400 });
    }

    if (userRec.member_id && String(userRec.member_id) === String(memberId)) {
      return NextResponse.json({ error: 'No puedes proponer en tu propio calendario' }, { status: 400 });
    }

    const validationError = validateProposalPayload(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

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
         color, status, created_by
       ) VALUES (
         $1, $2, $3, 'work', NULL,
         $4, $5, FALSE, $6,
         $7, $8, $9, $10,
         NULL, 'proposed', $11
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
        user.userId,
      ],
    );

    const created = insertRes.rows[0];
    const clientName = [userRec.first_name, userRec.last_name].filter(Boolean).join(' ').trim() || userRec.email;

    if (member.email) {
      try {
        await sendProposalReceivedToMember({
          memberEmail: member.email,
          memberName: member.name,
          clientName,
          clientEmail: userRec.email,
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
