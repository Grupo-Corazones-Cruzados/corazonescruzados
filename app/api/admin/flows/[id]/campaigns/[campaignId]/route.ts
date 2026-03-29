import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { campaignId } = await params;

    const { rows } = await pool.query(
      `SELECT c.*, cl.name as list_name
       FROM gcc_world.flow_campaigns c
       LEFT JOIN gcc_world.flow_contact_lists cl ON cl.id = c.contact_list_id
       WHERE c.id = $1`,
      [campaignId]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Campaign GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { campaignId } = await params;
    const body = await req.json();
    const { contact_list_id, from_email, subject, body_html, footer_html, attachments, status } = body;

    const { rows } = await pool.query(
      `UPDATE gcc_world.flow_campaigns SET
        contact_list_id = COALESCE($1, contact_list_id),
        from_email = COALESCE($2, from_email),
        subject = COALESCE($3, subject),
        body_html = COALESCE($4, body_html),
        footer_html = COALESCE($5, footer_html),
        attachments = COALESCE($6, attachments),
        status = COALESCE($7, status),
        updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [contact_list_id, from_email, subject, body_html, footer_html, attachments ? JSON.stringify(attachments) : null, status, campaignId]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Campaign PUT error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { campaignId } = await params;
    await pool.query(`DELETE FROM gcc_world.flow_campaigns WHERE id = $1`, [campaignId]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Campaign DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
