import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { rows } = await pool.query(
      `SELECT i.*, c.name as client_name, c.email as client_email
       FROM gcc_world.invoices i
       LEFT JOIN gcc_world.clients c ON c.id = i.client_id
       WHERE i.id = $1`,
      [id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const items = await pool.query(
      `SELECT * FROM gcc_world.invoice_items WHERE invoice_id = $1 ORDER BY id`,
      [id]
    );

    const inv = rows[0];
    // Don't send the binary blob to the client, just indicate presence
    const has_payment_proof = !!(inv.payment_proof);
    delete inv.payment_proof;

    return NextResponse.json({ data: { ...inv, items: items.rows, has_payment_proof } });
  } catch (err: any) {
    console.error('Invoice GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(body)) {
      if (['status', 'notes', 'tax', 'sent_at', 'paid_at'].includes(key)) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE gcc_world.invoices SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Invoice PATCH error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await pool.query('DELETE FROM gcc_world.invoices WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error('Invoice DELETE error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
