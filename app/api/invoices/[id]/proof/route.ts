import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Solo se permiten imagenes (JPG, PNG, WEBP, GIF)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    await pool.query(`ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS payment_proof BYTEA`);
    await pool.query(`ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS payment_proof_type VARCHAR(50)`);

    await pool.query(
      `UPDATE gcc_world.invoices SET payment_proof = $1, payment_proof_type = $2, updated_at = NOW() WHERE id = $3`,
      [buffer, file.type, id]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { rows: [inv] } = await pool.query(
      `SELECT payment_proof, payment_proof_type FROM gcc_world.invoices WHERE id = $1`, [id]
    );
    if (!inv?.payment_proof) return NextResponse.json({ error: 'Sin comprobante' }, { status: 404 });

    const buffer = Buffer.isBuffer(inv.payment_proof) ? inv.payment_proof : Buffer.from(inv.payment_proof);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': inv.payment_proof_type || 'image/jpeg',
        'Content-Disposition': `inline; filename="comprobante-${id}.${(inv.payment_proof_type || 'image/jpeg').split('/')[1]}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    await pool.query(
      `UPDATE gcc_world.invoices SET payment_proof = NULL, payment_proof_type = NULL, updated_at = NOW() WHERE id = $1`, [id]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
