import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { totalRecipients } from '@/lib/flows/campaign-send';

/**
 * Programa (o cancela) el envío de una campaña.
 *
 * POST   { scheduled_at: ISO }  → la deja 'scheduled'; el cron la envía cuando llegue la hora
 * DELETE                        → cancela la programación y vuelve a 'draft'
 *
 * ⚠️ El cron solo dispara campañas de flujos **activos**. Se avisa aquí en la respuesta
 * (`flowActive`) para que la interfaz lo diga en el momento de programar, en vez de dejar al
 * usuario esperando un correo que nunca va a salir.
 */

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === 'admin' ? user : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id, campaignId } = await params;

    const { rows: [campaign] } = await pool.query(
      `SELECT c.status, f.status AS flow_status
         FROM gcc_world.flow_campaigns c
         JOIN gcc_world.flows f ON f.id = c.flow_id
        WHERE c.id = $1 AND c.flow_id = $2`,
      [campaignId, id],
    );
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    if (campaign.status === 'sending') {
      return NextResponse.json({ error: 'Esta campaña ya está enviándose' }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const raw = String(body?.scheduled_at || '');
    const when = new Date(raw);
    if (!raw || Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: 'Fecha y hora inválidas' }, { status: 400 });
    }
    // Margen de un minuto: el cron corre cada 10, no tiene sentido programar "hace un rato".
    if (when.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: 'Esa fecha y hora ya pasaron' }, { status: 400 });
    }

    const total = await totalRecipients(campaignId);
    if (total === 0) {
      return NextResponse.json({ error: 'La campaña no tiene contactos con correo en sus listas' }, { status: 400 });
    }

    const { rows: [row] } = await pool.query(
      `UPDATE gcc_world.flow_campaigns
          SET scheduled_at = $1, status = 'scheduled', updated_at = NOW()
        WHERE id = $2 AND flow_id = $3
        RETURNING id, scheduled_at, status`,
      [when.toISOString(), campaignId, id],
    );

    return NextResponse.json({
      data: { ...row, total, flowActive: campaign.flow_status === 'active' },
    });
  } catch (err: any) {
    console.error('Campaign schedule POST error:', err.message);
    return NextResponse.json({ error: 'Error al programar la campaña' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id, campaignId } = await params;

    const { rows: [row] } = await pool.query(
      `UPDATE gcc_world.flow_campaigns
          SET scheduled_at = NULL, status = 'draft', updated_at = NOW()
        WHERE id = $1 AND flow_id = $2 AND status = 'scheduled'
        RETURNING id`,
      [campaignId, id],
    );
    if (!row) return NextResponse.json({ error: 'Esa campaña no está programada' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Campaign schedule DELETE error:', err.message);
    return NextResponse.json({ error: 'Error al cancelar la programación' }, { status: 500 });
  }
}
