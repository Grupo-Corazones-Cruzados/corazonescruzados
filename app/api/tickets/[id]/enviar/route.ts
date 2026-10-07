import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { findOrCreatePlaceholderByEmail, resolveMemberId } from '@/lib/clients/account';
import { anunciarTicket } from '@/lib/tickets/alta';

/**
 * ENVIAR UN BORRADOR (Fernando, 2026-10-07): «cuando ya quieren llevarlo al siguiente estado
 * deben tener conexión obligatoria». Esto ES ese paso, y por eso solo existe en el servidor.
 *
 * Borrador → «Pendiente», como nace hoy cualquier ticket. Antes de dejarlo salir se exige lo
 * que el formulario de alta exige (título, talento, cliente y fecha límite); después pasa lo
 * mismo que en una creación normal (`anunciarTicket`): correo al cliente y, si el cliente
 * venía solo por correo, su ficha y su invitación.
 *
 * Solo quien lo creó (o un administrador). Repetirlo sobre uno ya enviado responde 409: no
 * vuelve a escribirle al cliente.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: [t] } = await cliente.query(`SELECT * FROM gcc_world.tickets WHERE id = $1 FOR UPDATE`, [id]);
    if (!t || (t.status === 'draft' && String(t.user_id) !== user.userId && user.role !== 'admin')) {
      await cliente.query('ROLLBACK');
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }
    if (t.status !== 'draft') {
      await cliente.query('ROLLBACK');
      return NextResponse.json({ error: 'Este ticket ya no es un borrador' }, { status: 409 });
    }

    const faltan: string[] = [];
    if (!String(t.title || '').trim()) faltan.push('título');
    if (!Array.isArray(t.required_talents) || t.required_talents.length === 0) faltan.push('talento');
    if (!t.client_id && !t.draft_client_email) faltan.push('cliente');
    if (!t.deadline) faltan.push('fecha límite');
    if (faltan.length) {
      await cliente.query('ROLLBACK');
      return NextResponse.json({ error: `Para enviarlo falta: ${faltan.join(', ')}.` }, { status: 400 });
    }

    let clientId: number | null = t.client_id;
    let correo: string | null = null;
    let invitar: string | null = null;
    if (!clientId && t.draft_client_email) {
      const ph = await findOrCreatePlaceholderByEmail(t.draft_client_email, await resolveMemberId(user.userId));
      clientId = ph?.id ?? null;
      correo = t.draft_client_email;
      if (ph?.created) invitar = t.draft_client_email;
    } else if (clientId) {
      const { rows: [c] } = await cliente.query(`SELECT email FROM gcc_world.clients WHERE id = $1`, [clientId]);
      correo = c?.email || null;
    }

    const { rows: [enviado] } = await cliente.query(
      `UPDATE gcc_world.tickets SET status = 'pending', client_id = $2, draft_client_email = NULL, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [id, clientId],
    );
    await cliente.query('COMMIT');

    await anunciarTicket(enviado, {
      mode: 'create', resolvedMemberId: enviado.member_id, resolvedClientEmail: correo, invitePlaceholderEmail: invitar,
    });
    return NextResponse.json({ data: enviado });
  } catch (err: any) {
    await cliente.query('ROLLBACK').catch(() => {});
    console.error('Enviar borrador:', err.message);
    return NextResponse.json({ error: 'No se pudo enviar el borrador' }, { status: 500 });
  } finally {
    cliente.release();
  }
}
