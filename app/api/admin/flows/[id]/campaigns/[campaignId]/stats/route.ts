import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { campaignId } = await params;

    // Get campaign info
    const { rows: [campaign] } = await pool.query(
      `SELECT c.*, cl.name as list_name
       FROM gcc_world.flow_campaigns c
       LEFT JOIN gcc_world.flow_contact_lists cl ON cl.id = c.contact_list_id
       WHERE c.id = $1`,
      [campaignId]
    );
    if (!campaign) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    // Get all sends
    const { rows: sends } = await pool.query(
      `SELECT * FROM gcc_world.flow_campaign_sends WHERE campaign_id = $1 ORDER BY sent_at DESC`,
      [campaignId]
    );

    // Summary
    const total = sends.length;
    const sent = sends.filter((s: any) => s.status === 'sent').length;
    const delivered = sends.filter((s: any) => s.status === 'delivered').length;
    const bounced = sends.filter((s: any) => s.status === 'bounced').length;
    const failed = sends.filter((s: any) => s.status === 'failed').length;

    return NextResponse.json({
      campaign,
      summary: { total, sent, delivered, bounced, failed },
      sends,
    });
  } catch (err: any) {
    console.error('Campaign stats error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
