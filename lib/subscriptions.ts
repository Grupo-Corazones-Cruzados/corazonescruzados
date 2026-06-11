import { pool } from '@/lib/db';

/**
 * Suscripciones — cobros mensuales recurrentes a clientes.
 *
 * Modelo de cobro (confirmado con el usuario, 2026-06-11): UNA fila por MES
 * CALENDARIO desde el mes de `start_date` hasta el mes actual inclusive. El
 * vencimiento de cada mes es el "día de corte" (= el día del mes de `start_date`,
 * ej. 11) ajustado al último día si el mes es más corto (feb → 28/29). Un mes
 * aparece apenas comienza el mes calendario, aunque no haya llegado el día de corte.
 */

let _initialized = false;

export async function ensureSubscriptionTables() {
  if (_initialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.subscriptions (
      id SERIAL PRIMARY KEY,
      client_id INT,
      title TEXT NOT NULL,
      monthly_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      iva_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      start_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      payment_code VARCHAR(2) DEFAULT '01',
      client_id_type VARCHAR(2) DEFAULT '07',
      client_ruc VARCHAR(20),
      client_name_sri VARCHAR(300),
      client_email_sri VARCHAR(255),
      client_phone_sri VARCHAR(20),
      client_address_sri TEXT,
      created_by TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gcc_world.subscription_payments (
      id SERIAL PRIMARY KEY,
      subscription_id INT NOT NULL REFERENCES gcc_world.subscriptions(id) ON DELETE CASCADE,
      period DATE NOT NULL,
      paid BOOLEAN NOT NULL DEFAULT false,
      paid_at TIMESTAMPTZ,
      paid_by TEXT,
      invoice_id INT,
      amount NUMERIC(12,2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (subscription_id, period)
    );
    CREATE INDEX IF NOT EXISTS idx_subscription_payments_sub ON gcc_world.subscription_payments (subscription_id);
  `);
  _initialized = true;
}

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Days in a given month. `month` is 1-12. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Normalize a date coming from Postgres (the `pg` driver may return DATE columns
 * either as a 'YYYY-MM-DD' string or as a JS Date) into a 'YYYY-MM-DD' string.
 */
export function toYMD(value: string | Date): string {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  return String(value).split('T')[0];
}

/** Parse a date (string or Date) into {y, m, d} (1-based month). */
function parseYMD(s: string | Date): { y: number; m: number; d: number } {
  const [y, m, d] = toYMD(s).split('-').map(Number);
  return { y, m, d };
}

/** Today as {y, m, d} in server-local time. */
function todayYMD(): { y: number; m: number; d: number } {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

/** Whole-day difference dueDate − today (positive = due in the future). */
function dayDiff(due: { y: number; m: number; d: number }, today: { y: number; m: number; d: number }): number {
  const a = Date.UTC(due.y, due.m - 1, due.d);
  const b = Date.UTC(today.y, today.m - 1, today.d);
  return Math.round((a - b) / 86400000);
}

export interface PeriodInfo {
  period: string;          // 'YYYY-MM' (canonical period key)
  periodDate: string;      // 'YYYY-MM-01' (DB DATE value)
  label: string;           // 'Junio 2026'
  dueDate: string;         // 'YYYY-MM-DD' (cut day, clamped)
  paid: boolean;
  paidAt: string | null;
  invoiceId: number | null;
  amount: number | null;
  daysUntilDue: number;    // negative = overdue
  status: 'paid' | 'overdue' | 'due_soon' | 'upcoming';
}

export const ALERT_WINDOW_DAYS = 7;

/**
 * Derive the list of billable months for a subscription, from its start month to
 * the current month inclusive, merged with the recorded payments.
 */
export function computePeriods(
  startDate: string | Date,
  payments: { period: string | Date; paid: boolean; paid_at: string | Date | null; invoice_id: number | null; amount: string | number | null }[],
  alertWindowDays = ALERT_WINDOW_DAYS,
): PeriodInfo[] {
  const start = parseYMD(startDate);
  const today = todayYMD();
  const cutDay = start.d;

  // Map paid periods by 'YYYY-MM'
  const paidMap = new Map<string, { paid: boolean; paid_at: string | null; invoice_id: number | null; amount: number | null }>();
  for (const p of payments) {
    const key = toYMD(p.period).slice(0, 7); // 'YYYY-MM'
    paidMap.set(key, {
      paid: !!p.paid,
      paid_at: p.paid_at ? (p.paid_at instanceof Date ? p.paid_at.toISOString() : String(p.paid_at)) : null,
      invoice_id: p.invoice_id ?? null,
      amount: p.amount != null ? Number(p.amount) : null,
    });
  }

  const periods: PeriodInfo[] = [];
  let y = start.y;
  let m = start.m;
  // Guard against pathological future start dates → no periods.
  const endKey = today.y * 12 + (today.m - 1);
  let curKey = y * 12 + (m - 1);

  while (curKey <= endKey) {
    const key = `${y}-${pad2(m)}`;
    const dueDay = Math.min(cutDay, daysInMonth(y, m));
    const due = { y, m, d: dueDay };
    const diff = dayDiff(due, today);
    const rec = paidMap.get(key);
    const paid = !!rec?.paid;

    let status: PeriodInfo['status'];
    if (paid) status = 'paid';
    else if (diff < 0) status = 'overdue';
    else if (diff <= alertWindowDays) status = 'due_soon';
    else status = 'upcoming';

    periods.push({
      period: key,
      periodDate: `${key}-01`,
      label: `${MONTHS_ES[m - 1]} ${y}`,
      dueDate: `${y}-${pad2(m)}-${pad2(dueDay)}`,
      paid,
      paidAt: rec?.paid_at ?? null,
      invoiceId: rec?.invoice_id ?? null,
      amount: rec?.amount ?? null,
      daysUntilDue: diff,
      status,
    });

    // advance one month
    m++;
    if (m > 12) { m = 1; y++; }
    curKey = y * 12 + (m - 1);
  }

  return periods;
}

export interface SubscriptionSummary {
  totalPeriods: number;
  paidCount: number;
  pendingCount: number;
  nextDue: PeriodInfo | null;   // earliest unpaid period
  alert: 'overdue' | 'due_soon' | 'none';
}

/** Compact summary used by the list view (alert badge + next charge). */
export function summarizeSubscription(periods: PeriodInfo[]): SubscriptionSummary {
  const paidCount = periods.filter(p => p.paid).length;
  const unpaid = periods.filter(p => !p.paid);
  const nextDue = unpaid.length ? unpaid[0] : null;

  let alert: SubscriptionSummary['alert'] = 'none';
  if (unpaid.some(p => p.status === 'overdue')) alert = 'overdue';
  else if (unpaid.some(p => p.status === 'due_soon')) alert = 'due_soon';

  return {
    totalPeriods: periods.length,
    paidCount,
    pendingCount: unpaid.length,
    nextDue,
    alert,
  };
}
