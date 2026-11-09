import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { miembroDe } from '@/lib/projects/permisos';
import { sqlFacturaMia } from '@/lib/pertenencia';

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

    // El miembro, solo los clientes de SUS facturas (Fernando, 2026-11-09: «los miembros no deberían
    // ver los clientes de otros usuarios»); el administrador, todos.
    const params: unknown[] = [];
    let mias = '';
    if (user.role === 'member') {
      params.push(user.userId, await miembroDe(user.userId));
      mias = `AND ${sqlFacturaMia('i', '$1', '$2')}`;
    }
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (i.client_ruc)
         i.client_ruc,
         i.client_name_sri,
         i.client_email_sri,
         i.client_phone_sri,
         i.client_address_sri,
         i.created_at
       FROM gcc_world.invoices i
       WHERE i.client_ruc IS NOT NULL
         AND i.client_ruc <> ''
         AND i.client_ruc <> '9999999999999'
         AND i.client_name_sri IS NOT NULL
         AND i.client_name_sri <> ''
         ${mias}
       ORDER BY i.client_ruc, i.created_at DESC`,
      params,
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
