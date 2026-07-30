import { pool } from '@/lib/db';
import { sendViaGmail, workspaceSenderWithName } from '@/lib/integrations/google-workspace';
import { renderTemplate } from '@/lib/flows/variables';

/**
 * ENVÍO de una campaña de email masivo, **por lotes y reanudable**.
 *
 * Por qué por lotes: el envío recorre los contactos uno a uno contra la Gmail API dentro de
 * una petición HTTP, y Railway/Cloudflare cortan a los ~300 s. Con una lista grande el envío
 * se partía a medias y la campaña quedaba en 'sending' para siempre.
 *
 * Cómo se reanuda: `flow_campaigns.send_started_at` marca el arranque del envío EN CURSO, y
 * los pendientes son los que **no** tienen fila en `flow_campaign_sends` con
 * `sent_at >= send_started_at`. Cada pase (del cron o del botón) sigue donde quedó el
 * anterior y **nadie recibe el correo dos veces**. Un reenvío solo fija un
 * `send_started_at` nuevo y vuelve a escribir a todos.
 *
 * Como cada intento —exitoso o fallido— deja su fila, un contacto se intenta **una vez por
 * run**: el proceso siempre termina, nunca se queda reintentando en bucle.
 *
 * ⚠️ Las marcas de tiempo usan `clock_timestamp()`, NO `now()`: `now()` devuelve la hora de
 * INICIO DE LA TRANSACCIÓN, así que si el arranque y los envíos cayeran en la misma
 * transacción tendrían el mismo instante y un reenvío vería sus propios envíos como "ya
 * hechos" (se detectó probando justo eso). Con el reloj real la comparación no depende de
 * dónde estén los límites transaccionales.
 */

/** Correos por lote. Con ~1 s por correo deja margen de sobra bajo el tope de 300 s. */
export const BATCH_LIMIT = 120;
/** Tope de tiempo por lote. Manda el que se cumpla primero, este o `BATCH_LIMIT`. */
export const BATCH_MAX_MS = 100_000;

export interface BatchResult {
  sent: number;
  failed: number;
  /** Destinatarios que quedan pendientes tras este lote. */
  remaining: number;
  /** true = la campaña quedó completa (`status='sent'`). */
  done: boolean;
  total: number;
}

export class CampaignSendError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

function buildEmailHtml(bodyHtml: string, footerHtml: string): string {
  const footer = footerHtml
    ? `<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e1dfdd;">${footerHtml}</div>`
    : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;background-color:#faf9f8;margin:0;padding:40px 20px;color:#242424;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;overflow:hidden;border-radius:4px;">
  <div style="padding:32px;font-size:15px;line-height:1.6;color:#242424;">
    ${bodyHtml}
    ${footer}
  </div>
</div></body></html>`;
}

/** Subconsulta de las listas de la campaña (N:M + la columna antigua como respaldo). */
const LISTS_SQL = `
  SELECT list_id FROM gcc_world.flow_campaign_lists WHERE campaign_id = $1
  UNION
  SELECT c.contact_list_id FROM gcc_world.flow_campaigns c
   WHERE c.id = $1 AND c.contact_list_id IS NOT NULL`;

/** Destinatarios totales de la campaña: unión de sus listas, sin repetir correo. */
export async function totalRecipients(campaignId: number | string): Promise<number> {
  const { rows: [r] } = await pool.query(
    `SELECT COUNT(DISTINCT LOWER(ct.email))::int AS n
       FROM gcc_world.flow_contacts ct
      WHERE ct.list_id IN (${LISTS_SQL})
        AND ct.email IS NOT NULL AND ct.email <> ''`,
    [campaignId],
  );
  return r?.n || 0;
}

/** Pendientes del run en curso (los que aún no tienen intento con `sent_at >= desde`). */
export async function pendingRecipients(
  campaignId: number | string,
  since: string | Date,
  limit?: number,
): Promise<{ id: number; name: string; email: string; phone: string | null; position: string | null }[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (LOWER(ct.email)) ct.id, ct.name, ct.email, ct.phone, ct.position
       FROM gcc_world.flow_contacts ct
      WHERE ct.list_id IN (${LISTS_SQL})
        AND ct.email IS NOT NULL AND ct.email <> ''
        AND NOT EXISTS (
              SELECT 1 FROM gcc_world.flow_campaign_sends s
               WHERE s.campaign_id = $1
                 AND LOWER(s.contact_email) = LOWER(ct.email)
                 AND s.sent_at >= $2
            )
      ORDER BY LOWER(ct.email), ct.id
      ${limit ? 'LIMIT ' + Number(limit) : ''}`,
    [campaignId, since],
  );
  return rows;
}

/**
 * Arranca (o reinicia) el envío: pone la campaña en 'sending' y fija `send_started_at`, que
 * es lo que hace que los envíos anteriores dejen de contar y empiece un run limpio.
 */
export async function startCampaignRun(campaignId: number | string): Promise<Date> {
  const { rows: [r] } = await pool.query(
    `UPDATE gcc_world.flow_campaigns
        SET status = 'sending', send_started_at = clock_timestamp(), scheduled_at = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING send_started_at`,
    [campaignId],
  );
  if (!r) throw new CampaignSendError('Campaña no encontrada', 404);
  return r.send_started_at;
}

/**
 * Envía UN lote de la campaña. Se asume que ya está en curso (`send_started_at` puesto); si
 * no lo estuviera se arranca aquí, para que un 'sending' viejo sin marca no rompa el cron.
 */
export async function sendCampaignBatch(
  campaignId: number | string,
  opts?: { limit?: number; maxMs?: number },
): Promise<BatchResult> {
  const limit = opts?.limit ?? BATCH_LIMIT;
  const maxMs = opts?.maxMs ?? BATCH_MAX_MS;

  const { rows: [campaign] } = await pool.query(
    `SELECT * FROM gcc_world.flow_campaigns WHERE id = $1`, [campaignId],
  );
  if (!campaign) throw new CampaignSendError('Campaña no encontrada', 404);

  const since: Date = campaign.send_started_at || await startCampaignRun(campaignId);
  const total = await totalRecipients(campaignId);
  const batch = await pendingRecipients(campaignId, since, limit);

  // Del remitente se respeta el NOMBRE, nunca la dirección: sale de la cuenta corporativa.
  const sender = workspaceSenderWithName(campaign.from_email);

  const attachments = (campaign.attachments || []).map((a: any) => (
    a.content
      ? { filename: a.filename, content: Buffer.from(a.content, 'base64') }
      : { filename: a.filename, path: a.url }
  ));

  const startedAt = Date.now();
  let sent = 0, failed = 0;

  for (const contact of batch) {
    if (Date.now() - startedAt > maxMs) break;   // se corta el lote; el resto va en el próximo pase
    try {
      // Las variables se resuelven POR CONTACTO: cada correo sale personalizado.
      const html = buildEmailHtml(
        renderTemplate(campaign.body_html, contact),
        renderTemplate(campaign.footer_html, contact),
      );
      const result = await sendViaGmail({
        from: sender,
        to: contact.email,
        subject: renderTemplate(campaign.subject, contact, { html: false }),
        html,
        ...(attachments.length > 0 ? { attachments } : {}),
      });
      await pool.query(
        `INSERT INTO gcc_world.flow_campaign_sends (campaign_id, contact_name, contact_email, resend_id, status, sent_at)
         VALUES ($1, $2, $3, $4, 'sent', clock_timestamp())`,
        [campaignId, contact.name, contact.email, result.id || null],
      );
      sent++;
    } catch (err: any) {
      await pool.query(
        `INSERT INTO gcc_world.flow_campaign_sends (campaign_id, contact_name, contact_email, status, error_message, sent_at)
         VALUES ($1, $2, $3, 'failed', $4, clock_timestamp())`,
        [campaignId, contact.name, contact.email, (err?.message || 'Error desconocido').slice(0, 500)],
      );
      failed++;
    }
  }

  const remaining = (await pendingRecipients(campaignId, since)).length;
  const done = remaining === 0;

  if (done) {
    await pool.query(
      `UPDATE gcc_world.flow_campaigns SET status = 'sent', sent_at = clock_timestamp(), updated_at = NOW() WHERE id = $1`,
      [campaignId],
    );
  } else {
    await pool.query(
      `UPDATE gcc_world.flow_campaigns SET status = 'sending', updated_at = NOW() WHERE id = $1`,
      [campaignId],
    );
  }

  return { sent, failed, remaining, done, total };
}
