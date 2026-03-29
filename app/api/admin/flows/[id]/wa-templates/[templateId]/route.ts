import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { templateId } = await params;
    const { rows } = await pool.query(`SELECT * FROM gcc_world.flow_wa_templates WHERE id = $1`, [templateId]);
    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { templateId } = await params;
    const body = await req.json();
    const { name, language, header_type, header_content, header_filename, body: bodyText, footer, buttons } = body;

    const { rows } = await pool.query(
      `UPDATE gcc_world.flow_wa_templates SET
        name = COALESCE($1, name),
        language = COALESCE($2, language),
        header_type = COALESCE($3, header_type),
        header_content = $4,
        header_filename = $5,
        body = COALESCE($6, body),
        footer = $7,
        buttons = COALESCE($8, buttons)
       WHERE id = $9 RETURNING *`,
      [name, language, header_type, header_content, header_filename, bodyText, footer, buttons ? JSON.stringify(buttons) : null, templateId]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { templateId } = await params;
    await pool.query(`DELETE FROM gcc_world.flow_wa_templates WHERE id = $1`, [templateId]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
