import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureSubscriptionTables, computePeriods, summarizeSubscription, toYMD } from '@/lib/subscriptions';

const PER_PAGE_MAX = 100;

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ensureSubscriptionTables();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(PER_PAGE_MAX, Number(searchParams.get('limit')) || 15);
    const status = searchParams.get('status') || 'all';
    const search = (searchParams.get('search') || '').trim();

    const where: string[] = [];
    const params: any[] = [];
    if (status !== 'all') { params.push(status); where.push(`s.status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(s.title ILIKE $${params.length} OR s.client_name_sri ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM gcc_world.subscriptions s ${whereSql}`, params
    );

    const offset = (page - 1) * limit;
    const { rows: subs } = await pool.query(
      `SELECT s.*, c.name AS client_name
         FROM gcc_world.subscriptions s
         LEFT JOIN gcc_world.clients c ON c.id = s.client_id
         ${whereSql}
         ORDER BY s.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    // Load payments for the page's subscriptions in one query.
    const ids = subs.map((s: any) => s.id);
    const paymentsBySub = new Map<number, any[]>();
    if (ids.length) {
      const { rows: pays } = await pool.query(
        `SELECT subscription_id, period, paid, paid_at, invoice_id, amount
           FROM gcc_world.subscription_payments
          WHERE subscription_id = ANY($1::int[])`,
        [ids]
      );
      for (const p of pays) {
        const arr = paymentsBySub.get(p.subscription_id) || [];
        arr.push(p);
        paymentsBySub.set(p.subscription_id, arr);
      }
    }

    const data = subs.map((s: any) => {
      const periods = computePeriods(s.start_date, paymentsBySub.get(s.id) || []);
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
        client_id: s.client_id,
        client_name: s.client_name || s.client_name_sri || null,
        client_name_sri: s.client_name_sri,
        next_due: summary.nextDue ? {
          period: summary.nextDue.period,
          label: summary.nextDue.label,
          dueDate: summary.nextDue.dueDate,
          daysUntilDue: summary.nextDue.daysUntilDue,
          status: summary.nextDue.status,
        } : null,
        alert: summary.alert,
        paid_count: summary.paidCount,
        pending_count: summary.pendingCount,
        total_periods: summary.totalPeriods,
      };
    });

    return NextResponse.json({ data, total: count, page, limit });
  } catch (err: any) {
    console.error('Subscriptions list error:', err.message);
    return NextResponse.json({ data: [], total: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ensureSubscriptionTables();

    const body = await req.json();
    const title = String(body.title || '').trim();
    const monthlyCost = Number(body.monthly_cost);
    const ivaRate = body.iva_rate != null ? Number(body.iva_rate) : 0;
    const startDate = String(body.start_date || '').split('T')[0];
    const idType = String(body.client_id_type || '07');
    const isConsumidorFinal = idType === '07';
    const clientRuc = isConsumidorFinal ? '9999999999999' : String(body.client_ruc || '').trim();
    const clientName = isConsumidorFinal ? 'CONSUMIDOR FINAL' : String(body.client_name_sri || '').trim();

    if (!title) return NextResponse.json({ error: 'El título de la suscripción es requerido' }, { status: 400 });
    if (!monthlyCost || monthlyCost <= 0) return NextResponse.json({ error: 'El costo mensual debe ser mayor a 0' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return NextResponse.json({ error: 'Fecha de inicio inválida' }, { status: 400 });
    if (!isConsumidorFinal && !clientName) return NextResponse.json({ error: 'La razón social del cliente es requerida' }, { status: 400 });
    if (!isConsumidorFinal && !clientRuc) return NextResponse.json({ error: 'La identificación del cliente es requerida' }, { status: 400 });

    const { rows: [sub] } = await pool.query(
      `INSERT INTO gcc_world.subscriptions
         (client_id, title, monthly_cost, iva_rate, currency, start_date, status, payment_code,
          client_id_type, client_ruc, client_name_sri, client_email_sri, client_phone_sri, client_address_sri,
          created_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        body.client_id ? Number(body.client_id) : null,
        title, monthlyCost, ivaRate, String(body.currency || 'USD'), startDate,
        String(body.payment_code || '01'),
        idType, clientRuc, clientName,
        String(body.client_email_sri || '').trim() || null,
        String(body.client_phone_sri || '').trim() || null,
        String(body.client_address_sri || '').trim() || null,
        user.email, String(body.notes || '').trim() || null,
      ]
    );

    return NextResponse.json({ data: { id: sub.id } });
  } catch (err: any) {
    console.error('Subscription create error:', err.message);
    return NextResponse.json({ error: 'Error al crear la suscripción' }, { status: 500 });
  }
}
