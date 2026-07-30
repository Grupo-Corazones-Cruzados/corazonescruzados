import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { workspaceOrganizer, workspaceSenderWithName } from '@/lib/integrations/google-workspace';

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

    // `lists` = listas asociadas (relación N:M) y `total_contacts` = destinatarios reales de
    // la campaña: la UNIÓN de esas listas sin repetir correo (un contacto en dos listas
    // recibe un solo correo). `contact_list_id` sigue contando como respaldo de las campañas
    // anteriores a la relación N:M.
    const { rows } = await pool.query(
      `WITH camp_lists AS (
         SELECT c.id AS campaign_id, l.id AS list_id, l.name
           FROM gcc_world.flow_campaigns c
           JOIN gcc_world.flow_contact_lists l
             ON l.id IN (
                  SELECT list_id FROM gcc_world.flow_campaign_lists WHERE campaign_id = c.id
                  UNION
                  SELECT c.contact_list_id WHERE c.contact_list_id IS NOT NULL
                )
          WHERE c.flow_id = $1
       )
       -- OJO: aquí NO van body_html, footer_html ni attachments. Los adjuntos se guardan en
       -- base64 dentro de la fila, así que un SELECT * devolvia megabytes por campana y
       -- dejaba la pantalla colgada del "Cargando...". El contenido completo lo da el GET de
       -- UNA campana, que es cuando de verdad se necesita (editar / previsualizar).
       SELECT c.id, c.flow_id, c.contact_list_id, c.from_email, c.subject, c.status,
              c.wa_template_id, c.sent_at, c.scheduled_at, c.send_started_at, c.created_at, c.updated_at,
              COALESCE(jsonb_array_length(c.attachments), 0) AS attachment_count,
              wt.name as wa_template_name,
              -- list_name se conserva para el panel de WhatsApp, que usa una sola lista.
              (SELECT k.name FROM camp_lists k WHERE k.campaign_id = c.id ORDER BY k.name LIMIT 1) AS list_name,
              COALESCE((SELECT json_agg(json_build_object('id', k.list_id, 'name', k.name) ORDER BY k.name)
                          FROM camp_lists k WHERE k.campaign_id = c.id), '[]'::json) AS lists,
              (SELECT COUNT(DISTINCT LOWER(ct.email))::int
                 FROM gcc_world.flow_contacts ct
                WHERE ct.list_id IN (SELECT k.list_id FROM camp_lists k WHERE k.campaign_id = c.id)
                  AND ct.email IS NOT NULL AND ct.email <> '') as total_contacts,
              (SELECT COUNT(*)::int FROM gcc_world.flow_campaign_sends WHERE campaign_id = c.id AND status = 'sent') as sent_count,
              (SELECT COUNT(*)::int FROM gcc_world.flow_campaign_sends WHERE campaign_id = c.id AND status = 'failed') as failed_count
       FROM gcc_world.flow_campaigns c
       LEFT JOIN gcc_world.flow_wa_templates wt ON wt.id = c.wa_template_id
       WHERE c.flow_id = $1
       ORDER BY c.created_at DESC`,
      [id]
    );

    // `senderAddress` = la dirección desde la que sale TODO el correo. Va en la respuesta
    // para que el panel la muestre: el usuario elige el nombre visible, no la dirección.
    return NextResponse.json({ data: rows, senderAddress: workspaceOrganizer() });
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
    const { contact_list_id, list_ids, from_name, from_email, subject, body_html, footer_html, attachments, wa_template_id } = body;

    if (!wa_template_id && !subject) {
      return NextResponse.json({ error: 'El asunto es requerido' }, { status: 400 });
    }

    // Del remitente se guarda el nombre que puso el usuario, pero con la DIRECCIÓN de la
    // cuenta corporativa: nunca se persiste un correo de otro dominio.
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.flow_campaigns (flow_id, contact_list_id, from_email, subject, body_html, footer_html, attachments, wa_template_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, contact_list_id || null, wa_template_id ? '' : workspaceSenderWithName(from_name ?? from_email), subject || '', body_html || '', footer_html || '', JSON.stringify(attachments || []), wa_template_id || null]
    );

    // Listas asociadas (relación N:M). Solo se aceptan listas de ESTE flujo.
    const ids = [
      ...(Array.isArray(list_ids) ? list_ids : []),
      ...(contact_list_id ? [contact_list_id] : []),
    ].map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length) {
      await pool.query(
        `INSERT INTO gcc_world.flow_campaign_lists (campaign_id, list_id)
         SELECT $1, l.id FROM gcc_world.flow_contact_lists l
          WHERE l.flow_id = $2 AND l.id = ANY($3::int[])
         ON CONFLICT DO NOTHING`,
        [rows[0].id, id, ids],
      );
    }

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Campaigns POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
