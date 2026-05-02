import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

function inferIdType(ruc: string | null): string {
  if (!ruc) return '07';
  if (ruc === '9999999999999') return '07';
  if (ruc.length === 13 && ruc.endsWith('001')) return '04';
  if (ruc.length === 10) return '05';
  return '06';
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { rows } = await pool.query(
      `SELECT DISTINCT ON (client_ruc)
         client_ruc,
         client_name_sri,
         client_email_sri,
         client_phone_sri,
         client_address_sri,
         created_at
       FROM gcc_world.invoices
       WHERE client_ruc IS NOT NULL
         AND client_ruc <> ''
         AND client_ruc <> '9999999999999'
         AND client_name_sri IS NOT NULL
         AND client_name_sri <> ''
       ORDER BY client_ruc, created_at DESC`,
    );

    const data = rows.map((r: any) => ({
      id_type: inferIdType(r.client_ruc),
      client_ruc: r.client_ruc,
      client_name: r.client_name_sri,
      client_email: r.client_email_sri || '',
      client_phone: r.client_phone_sri || '',
      client_address: r.client_address_sri || '',
      last_used: r.created_at,
    }));

    data.sort((a: { client_name: string }, b: { client_name: string }) =>
      a.client_name.localeCompare(b.client_name),
    );

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('clients-history error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
