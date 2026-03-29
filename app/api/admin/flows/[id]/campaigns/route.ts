import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.flow_campaigns (
      id SERIAL PRIMARY KEY,
      flow_id INT NOT NULL REFERENCES gcc_world.flows(id) ON DELETE CASCADE,
      contact_list_id INT REFERENCES gcc_world.flow_contact_lists(id) ON DELETE SET NULL,
      from_email VARCHAR(255) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      body_html TEXT NOT NULL DEFAULT '',
      footer_html TEXT NOT NULL DEFAULT '',
      attachments JSONB DEFAULT '[]',
      wa_template_id INT,
      status VARCHAR(20) DEFAULT 'draft',
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE gcc_world.flow_campaigns ADD COLUMN IF NOT EXISTS wa_template_id INT;
    ALTER TABLE gcc_world.flow_campaigns ALTER COLUMN from_email DROP NOT NULL;
    ALTER TABLE gcc_world.flow_campaigns ALTER COLUMN subject DROP NOT NULL;
    CREATE TABLE IF NOT EXISTS gcc_world.flow_campaign_sends (
      id SERIAL PRIMARY KEY,
      campaign_id INT NOT NULL REFERENCES gcc_world.flow_campaigns(id) ON DELETE CASCADE,
      contact_name VARCHAR(255),
      contact_email VARCHAR(255) NOT NULL,
      resend_id VARCHAR(255),
      status VARCHAR(20) DEFAULT 'pending',
      error_message TEXT,
      sent_at TIMESTAMPTZ
    );
  `);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ data: [] }, { status: 403 });

    await ensureTables();
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT c.*,
              cl.name as list_name,
              wt.name as wa_template_name,
              (SELECT COUNT(*)::int FROM gcc_world.flow_contacts WHERE list_id = c.contact_list_id) as total_contacts,
              (SELECT COUNT(*)::int FROM gcc_world.flow_campaign_sends WHERE campaign_id = c.id AND status = 'sent') as sent_count,
              (SELECT COUNT(*)::int FROM gcc_world.flow_campaign_sends WHERE campaign_id = c.id AND status = 'failed') as failed_count
       FROM gcc_world.flow_campaigns c
       LEFT JOIN gcc_world.flow_contact_lists cl ON cl.id = c.contact_list_id
       LEFT JOIN gcc_world.flow_wa_templates wt ON wt.id = c.wa_template_id
       WHERE c.flow_id = $1
       ORDER BY c.created_at DESC`,
      [id]
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Campaigns GET error:', err.message);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await ensureTables();
    const { id } = await params;
    const body = await req.json();
    const { contact_list_id, from_email, subject, body_html, footer_html, attachments, wa_template_id } = body;

    // For email campaigns, require from_email and subject
    if (!wa_template_id && (!from_email || !subject)) {
      return NextResponse.json({ error: 'Email remitente y asunto son requeridos' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.flow_campaigns (flow_id, contact_list_id, from_email, subject, body_html, footer_html, attachments, wa_template_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, contact_list_id, from_email || '', subject || '', body_html || '', footer_html || '', JSON.stringify(attachments || []), wa_template_id || null]
    );

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Campaigns POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
