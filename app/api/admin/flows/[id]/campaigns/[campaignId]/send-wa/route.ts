import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: flowId, campaignId } = await params;
    const body = await req.json().catch(() => ({}));

    // Get flow config (WhatsApp credentials)
    const { rows: [flow] } = await pool.query(`SELECT config FROM gcc_world.flows WHERE id = $1`, [flowId]);
    if (!flow) return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 });

    const config = flow.config || {};
    if (!config.phone_number_id || !config.access_token) {
      return NextResponse.json({ error: 'Configuracion de WhatsApp incompleta' }, { status: 400 });
    }

    // Get campaign
    const { rows: [campaign] } = await pool.query(`SELECT * FROM gcc_world.flow_campaigns WHERE id = $1`, [campaignId]);
    if (!campaign) return NextResponse.json({ error: 'Campana no encontrada' }, { status: 404 });
    if (campaign.status === 'sending') return NextResponse.json({ error: 'Campana en proceso' }, { status: 400 });

    // Get template — use override if provided
    const templateId = body.wa_template_id || campaign.wa_template_id;
    if (!templateId) return NextResponse.json({ error: 'No hay plantilla asignada' }, { status: 400 });

    const { rows: [template] } = await pool.query(`SELECT * FROM gcc_world.flow_wa_templates WHERE id = $1`, [templateId]);
    if (!template) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });

    // Get contacts
    const { rows: contacts } = await pool.query(
      `SELECT name, phone FROM gcc_world.flow_contacts WHERE list_id = $1 AND phone IS NOT NULL AND phone != ''`,
      [campaign.contact_list_id]
    );
    if (contacts.length === 0) return NextResponse.json({ error: 'Sin contactos con telefono' }, { status: 400 });

    // Mark as sending
    await pool.query(`UPDATE gcc_world.flow_campaigns SET status = 'sending', updated_at = NOW() WHERE id = $1`, [campaignId]);

    const apiUrl = `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`;
    let sentCount = 0;
    let failedCount = 0;

    // Build template components
    const components: any[] = [];
    if (template.header_type === 'image' && template.header_content) {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: template.header_content } }],
      });
    } else if (template.header_type === 'video' && template.header_content) {
      components.push({
        type: 'header',
        parameters: [{ type: 'video', video: { link: template.header_content } }],
      });
    } else if (template.header_type === 'document' && template.header_content) {
      components.push({
        type: 'header',
        parameters: [{ type: 'document', document: { link: template.header_content, filename: template.header_filename || 'documento' } }],
      });
    }

    for (const contact of contacts) {
      const phone = contact.phone.replace(/[^0-9+]/g, '');
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone,
            type: 'template',
            template: {
              name: template.name,
              language: { code: template.language || 'es' },
              ...(components.length > 0 ? { components } : {}),
            },
          }),
        });

        const result = await res.json();

        if (res.ok && result.messages?.[0]) {
          await pool.query(
            `INSERT INTO gcc_world.flow_campaign_sends (campaign_id, contact_name, contact_email, resend_id, status, sent_at)
             VALUES ($1, $2, $3, $4, 'sent', NOW())`,
            [campaignId, contact.name, phone, result.messages[0].id]
          );
          sentCount++;
        } else {
          const errorMsg = result.error?.message || JSON.stringify(result.error || result);
          await pool.query(
            `INSERT INTO gcc_world.flow_campaign_sends (campaign_id, contact_name, contact_email, status, error_message, sent_at)
             VALUES ($1, $2, $3, 'failed', $4, NOW())`,
            [campaignId, contact.name, phone, errorMsg]
          );
          failedCount++;
        }
      } catch (sendErr: any) {
        await pool.query(
          `INSERT INTO gcc_world.flow_campaign_sends (campaign_id, contact_name, contact_email, status, error_message, sent_at)
           VALUES ($1, $2, $3, 'failed', $4, NOW())`,
          [campaignId, contact.name, phone, sendErr.message || 'Error desconocido']
        );
        failedCount++;
      }
    }

    await pool.query(`UPDATE gcc_world.flow_campaigns SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`, [campaignId]);

    return NextResponse.json({ ok: true, sent: sentCount, failed: failedCount, total: contacts.length });
  } catch (err: any) {
    console.error('WA send error:', err.message);
    const { campaignId } = await params;
    await pool.query(`UPDATE gcc_world.flow_campaigns SET status = 'draft', updated_at = NOW() WHERE id = $1`, [campaignId]);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
