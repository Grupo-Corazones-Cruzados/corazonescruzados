import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { workspaceSenderWithName } from '@/lib/integrations/google-workspace';

/**
 * Una campaña del flujo.
 *
 * GET    → la campaña + sus listas asociadas (`lists`)
 * PUT    → edita asunto / cuerpo / pie / adjuntos / estado / nombre del remitente
 * DELETE → la borra (sus envíos y vínculos con listas caen por CASCADE)
 *
 * Todo filtra por `flow_id`: desde un flujo no se toca la campaña de otro.
 */

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === 'admin' ? user : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, campaignId } = await params;

    const { rows } = await pool.query(
      `SELECT c.*,
              COALESCE((
                SELECT json_agg(json_build_object('id', l.id, 'name', l.name) ORDER BY l.name)
                  FROM gcc_world.flow_contact_lists l
                 WHERE l.id IN (
                         SELECT list_id FROM gcc_world.flow_campaign_lists WHERE campaign_id = c.id
                         UNION
                         SELECT c.contact_list_id WHERE c.contact_list_id IS NOT NULL
                       )
              ), '[]'::json) AS lists
         FROM gcc_world.flow_campaigns c
        WHERE c.id = $1 AND c.flow_id = $2`,
      [campaignId, id]
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
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, campaignId } = await params;
    const body = await req.json();
    const { from_name, from_email, subject, body_html, footer_html, attachments, status } = body;

    // Del remitente solo se guarda el NOMBRE; la dirección la impone la cuenta corporativa.
    const fromValue = (from_name !== undefined || from_email !== undefined)
      ? workspaceSenderWithName(from_name ?? from_email)
      : null;

    const { rows } = await pool.query(
      `UPDATE gcc_world.flow_campaigns SET
        from_email = COALESCE($1, from_email),
        subject = COALESCE($2, subject),
        body_html = COALESCE($3, body_html),
        footer_html = COALESCE($4, footer_html),
        attachments = COALESCE($5, attachments),
        status = COALESCE($6, status),
        updated_at = NOW()
       WHERE id = $7 AND flow_id = $8
       RETURNING *`,
      [fromValue, subject, body_html, footer_html, attachments ? JSON.stringify(attachments) : null, status, campaignId, id]
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
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, campaignId } = await params;
    const { rowCount } = await pool.query(
      `DELETE FROM gcc_world.flow_campaigns WHERE id = $1 AND flow_id = $2`,
      [campaignId, id]
    );
    if (!rowCount) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Campaign DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
