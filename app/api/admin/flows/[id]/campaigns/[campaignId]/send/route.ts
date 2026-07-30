import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { workspaceSenderWithName } from '@/lib/integrations/google-workspace';
import {
  startCampaignRun, sendCampaignBatch, totalRecipients, CampaignSendError,
} from '@/lib/flows/campaign-send';

/**
 * Envía (o reenvía) una campaña AHORA.
 *
 * El envío es **por lotes**: aquí se manda el primer lote, así que una lista normal termina
 * en el acto y el usuario ve el resultado. Si quedan destinatarios (lista grande), la campaña
 * se queda en 'sending' y el **cron la continúa** cada 10 min hasta acabar — antes esto
 * recorría toda la lista dentro de la petición y se cortaba al llegar al tope de ~300 s de
 * Railway/Cloudflare, dejando la campaña colgada.
 *
 * La lógica de envío vive en `lib/flows/campaign-send.ts`, compartida con el cron.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  const { id, campaignId } = await params;
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { rows: [campaign] } = await pool.query(
      `SELECT * FROM gcc_world.flow_campaigns WHERE id = $1 AND flow_id = $2`,
      [campaignId, id],
    );
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    if (campaign.status === 'sending') {
      return NextResponse.json({ error: 'Esta campaña ya está enviándose' }, { status: 409 });
    }

    // Permite sobreescribir el contenido para un reenvío distinto. Del remitente solo se
    // toma el NOMBRE; la dirección siempre es la de la cuenta corporativa.
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, any> = {};
    if (body.body_html !== undefined) patch.body_html = body.body_html;
    if (body.footer_html !== undefined) patch.footer_html = body.footer_html;
    if (body.subject !== undefined) patch.subject = body.subject;
    if (body.attachments !== undefined) patch.attachments = JSON.stringify(body.attachments);
    if (body.from_name !== undefined) patch.from_email = workspaceSenderWithName(body.from_name);
    else if (body.from_email !== undefined) patch.from_email = workspaceSenderWithName(body.from_email);

    if (Object.keys(patch).length > 0) {
      const cols = Object.keys(patch).map((k, i) => `${k} = $${i + 2}`).join(', ');
      await pool.query(
        `UPDATE gcc_world.flow_campaigns SET ${cols}, updated_at = NOW() WHERE id = $1`,
        [campaignId, ...Object.values(patch)],
      );
    }

    const total = await totalRecipients(campaignId);
    if (total === 0) {
      return NextResponse.json({ error: 'La campaña no tiene contactos con correo en sus listas' }, { status: 400 });
    }

    await startCampaignRun(campaignId);
    const result = await sendCampaignBatch(campaignId);

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
      total: result.total,
      remaining: result.remaining,
      done: result.done,
    });
  } catch (err: any) {
    if (err instanceof CampaignSendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Campaign send error:', err.message);
    // Si el arranque falló, la campaña no debe quedarse en 'sending'.
    await pool.query(
      `UPDATE gcc_world.flow_campaigns SET status = 'draft', updated_at = NOW()
        WHERE id = $1 AND status = 'sending'
          AND NOT EXISTS (SELECT 1 FROM gcc_world.flow_campaign_sends WHERE campaign_id = $1)`,
      [campaignId],
    ).catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
