import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';

/**
 * Listas de contactos asociadas a una campaña (relación N:M `flow_campaign_lists`).
 * Es lo que mueven las casillas del panel de listas.
 *
 * GET  → listas asociadas
 * POST → { list_id, attached: boolean } asocia o desasocia UNA lista (idempotente)
 * PUT  → { list_ids: number[] } reemplaza el conjunto completo
 *
 * Todo se valida contra el flujo: solo se pueden asociar listas del MISMO flujo, así que
 * una campaña nunca acaba apuntando a la lista de otro flujo.
 */

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === 'admin' ? user : null;
}

/** La campaña existe y pertenece a este flujo. */
async function campaignInFlow(flowId: string, campaignId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.flow_campaigns WHERE id = $1 AND flow_id = $2`,
    [campaignId, flowId],
  );
  return rows.length > 0;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id, campaignId } = await params;
    if (!await campaignInFlow(id, campaignId)) return NextResponse.json({ error: 'La campaña no existe' }, { status: 404 });

    const { rows } = await pool.query(
      `SELECT l.id, l.name,
              (SELECT COUNT(*)::int FROM gcc_world.flow_contacts WHERE list_id = l.id) AS contact_count
         FROM gcc_world.flow_campaign_lists cl
         JOIN gcc_world.flow_contact_lists l ON l.id = cl.list_id
        WHERE cl.campaign_id = $1
        ORDER BY l.name`,
      [campaignId],
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Campaign lists GET error:', err.message);
    return NextResponse.json({ error: 'Error al leer las listas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id, campaignId } = await params;
    if (!await campaignInFlow(id, campaignId)) return NextResponse.json({ error: 'La campaña no existe' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const listId = Number(body?.list_id);
    const attached = body?.attached !== false;
    if (!Number.isInteger(listId) || listId <= 0) return NextResponse.json({ error: 'Lista inválida' }, { status: 400 });

    if (attached) {
      // La lista tiene que ser del mismo flujo.
      const { rows } = await pool.query(
        `SELECT 1 FROM gcc_world.flow_contact_lists WHERE id = $1 AND flow_id = $2`, [listId, id],
      );
      if (rows.length === 0) return NextResponse.json({ error: 'Esa lista no pertenece a este flujo' }, { status: 400 });

      await pool.query(
        `INSERT INTO gcc_world.flow_campaign_lists (campaign_id, list_id) VALUES ($1, $2)
         ON CONFLICT (campaign_id, list_id) DO NOTHING`,
        [campaignId, listId],
      );
    } else {
      await pool.query(
        `DELETE FROM gcc_world.flow_campaign_lists WHERE campaign_id = $1 AND list_id = $2`,
        [campaignId, listId],
      );
      // Si la lista era la del campo antiguo, se limpia para que no reaparezca al enviar.
      await pool.query(
        `UPDATE gcc_world.flow_campaigns SET contact_list_id = NULL, updated_at = NOW()
          WHERE id = $1 AND contact_list_id = $2`,
        [campaignId, listId],
      );
    }

    return NextResponse.json({ ok: true, attached });
  } catch (err: any) {
    console.error('Campaign lists POST error:', err.message);
    return NextResponse.json({ error: 'Error al actualizar las listas' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id, campaignId } = await params;
    if (!await campaignInFlow(id, campaignId)) return NextResponse.json({ error: 'La campaña no existe' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.list_ids) ? body.list_ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0) : [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM gcc_world.flow_campaign_lists WHERE campaign_id = $1`, [campaignId]);
      if (ids.length) {
        await client.query(
          `INSERT INTO gcc_world.flow_campaign_lists (campaign_id, list_id)
           SELECT $1, l.id FROM gcc_world.flow_contact_lists l
            WHERE l.flow_id = $2 AND l.id = ANY($3::int[])
           ON CONFLICT DO NOTHING`,
          [campaignId, id, ids],
        );
      }
      await client.query(
        `UPDATE gcc_world.flow_campaigns SET contact_list_id = NULL, updated_at = NOW() WHERE id = $1`,
        [campaignId],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Campaign lists PUT error:', err.message);
    return NextResponse.json({ error: 'Error al guardar las listas' }, { status: 500 });
  }
}
