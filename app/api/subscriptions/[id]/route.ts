import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureSubscriptionTables, computePeriods, summarizeSubscription, toYMD } from '@/lib/subscriptions';

async function loadDetail(id: number) {
  const { rows: [s] } = await pool.query(
    `SELECT s.*, c.name AS client_name
       FROM gcc_world.subscriptions s
       LEFT JOIN gcc_world.clients c ON c.id = s.client_id
      WHERE s.id = $1`,
    [id]
  );
  if (!s) return null;
  const { rows: pays } = await pool.query(
    `SELECT period, paid, paid_at, invoice_id, amount FROM gcc_world.subscription_payments WHERE subscription_id = $1`,
    [id]
  );
  const periods = computePeriods(s.start_date, pays);
  const summary = summarizeSubscription(periods);
  const startYMD = toYMD(s.start_date);
  const cutDay = Number(startYMD.split('-')[2]);
  return {
    id: s.id,
    title: s.title,
    monthly_cost: Number(s.monthly_cost),
    iva_rate: Number(s.iva_rate),
    currency: s.currency,
    start_date: startYMD,
    cut_day: cutDay,
    status: s.status,
    payment_code: s.payment_code,
    client_id: s.client_id,
    client_name: s.client_name || s.client_name_sri || null,
    client_id_type: s.client_id_type,
    client_ruc: s.client_ruc,
    client_name_sri: s.client_name_sri,
    client_email_sri: s.client_email_sri,
    client_phone_sri: s.client_phone_sri,
    client_address_sri: s.client_address_sri,
    notes: s.notes,
    periods,
    summary,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ensureSubscriptionTables();
    const { id } = await params;
    const detail = await loadDetail(Number(id));
    if (!detail) return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    return NextResponse.json({ data: detail });
  } catch (err: any) {
    console.error('Subscription detail error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ensureSubscriptionTables();
    const { id } = await params;
    const body = await req.json();

    const fields: string[] = [];
    const values: any[] = [];
    const set = (col: string, val: any) => { values.push(val); fields.push(`${col} = $${values.length}`); };

    if (body.title != null) {
      const t = String(body.title).trim();
      if (!t) return NextResponse.json({ error: 'El título no puede estar vacío' }, { status: 400 });
      set('title', t);
    }
    if (body.monthly_cost != null) {
      const mc = Number(body.monthly_cost);
      if (!mc || mc <= 0) return NextResponse.json({ error: 'El costo mensual debe ser mayor a 0' }, { status: 400 });
      set('monthly_cost', mc);
    }
    if (body.iva_rate != null) set('iva_rate', Number(body.iva_rate));
    if (body.currency != null) set('currency', String(body.currency));
    if (body.start_date != null) {
      const sd = String(body.start_date).split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sd)) return NextResponse.json({ error: 'Fecha de inicio inválida' }, { status: 400 });
      set('start_date', sd);
    }
    if (body.status != null) {
      const st = String(body.status);
      if (!['active', 'paused', 'cancelled'].includes(st)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
      set('status', st);
    }
    if (body.payment_code != null) set('payment_code', String(body.payment_code));
    if (body.notes != null) set('notes', String(body.notes).trim() || null);
    if (body.client_id !== undefined) set('client_id', body.client_id ? Number(body.client_id) : null);
    if (body.client_id_type != null) set('client_id_type', String(body.client_id_type));
    if (body.client_ruc != null) set('client_ruc', String(body.client_ruc).trim() || null);
    if (body.client_name_sri != null) set('client_name_sri', String(body.client_name_sri).trim() || null);
    if (body.client_email_sri != null) set('client_email_sri', String(body.client_email_sri).trim() || null);
    if (body.client_phone_sri != null) set('client_phone_sri', String(body.client_phone_sri).trim() || null);
    if (body.client_address_sri != null) set('client_address_sri', String(body.client_address_sri).trim() || null);

    if (!fields.length) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    fields.push(`updated_at = NOW()`);
    values.push(Number(id));
    await pool.query(`UPDATE gcc_world.subscriptions SET ${fields.join(', ')} WHERE id = $${values.length}`, values);

    const detail = await loadDetail(Number(id));
    return NextResponse.json({ data: detail });
  } catch (err: any) {
    console.error('Subscription update error:', err.message);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ensureSubscriptionTables();
    const { id } = await params;
    // Las facturas SRI ya emitidas NO se borran (son documentos fiscales); solo se
    // elimina la suscripción y su historial de marcas de pago (cascade).
    await pool.query(`DELETE FROM gcc_world.subscriptions WHERE id = $1`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Subscription delete error:', err.message);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
