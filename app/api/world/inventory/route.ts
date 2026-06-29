import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/world/auth';

export async function GET() {
  try {
    const me = await getAuthedClient();
    if (!me) return NextResponse.json({ inventory: {}, equipped: null });
    const r = await pool.query(
      `SELECT inventory, picked_items, equipped_item
         FROM gcc_world.clients
        WHERE id = $1
        LIMIT 1`,
      [me.id],
    );
    const row = r.rows[0];
    return NextResponse.json({
      inventory: row?.inventory ?? {},
      pickedItems: row?.picked_items ?? [],
      equipped: row?.equipped_item ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: pick up an item placement.
// Body: { placementId: string, itemId: string }
export async function POST(req: Request) {
  try {
    const me = await getAuthedClient();
    if (!me)
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 },
      );
    const { placementId, itemId } = await req.json();
    if (typeof placementId !== 'string' || typeof itemId !== 'string') {
      return NextResponse.json(
        { error: 'placementId e itemId requeridos' },
        { status: 400 },
      );
    }

    const r = await pool.query(
      `SELECT inventory, picked_items FROM gcc_world.clients WHERE id = $1`,
      [me.id],
    );
    const row = r.rows[0];
    const picked: string[] = row?.picked_items ?? [];
    if (picked.includes(placementId)) {
      // Already picked up by this client; idempotent success.
      return NextResponse.json({
        ok: true,
        inventory: row.inventory,
        pickedItems: picked,
      });
    }
    const inv: Record<string, number> = { ...(row?.inventory ?? {}) };
    inv[itemId] = (inv[itemId] ?? 0) + 1;
    const newPicked = [...picked, placementId];
    await pool.query(
      `UPDATE gcc_world.clients
          SET inventory = $1::jsonb,
              picked_items = $2::jsonb
        WHERE id = $3`,
      [JSON.stringify(inv), JSON.stringify(newPicked), me.id],
    );
    return NextResponse.json({
      ok: true,
      inventory: inv,
      pickedItems: newPicked,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT: equip / unequip an item — Body: { equipped: string | null }
//      o descartar (eliminar) un ítem del inventario — Body: { discard: itemId }
export async function PUT(req: Request) {
  try {
    const me = await getAuthedClient();
    if (!me)
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 },
      );
    const body = await req.json();

    // Descartar (eliminar) un ítem del inventario; si estaba equipado, se
    // desequipa también.
    if (typeof body?.discard === 'string' && body.discard.length > 0) {
      const { rows } = await pool.query(
        `SELECT inventory, equipped_item FROM gcc_world.clients WHERE id = $1`,
        [me.id],
      );
      const inv: Record<string, number> = { ...(rows[0]?.inventory ?? {}) };
      delete inv[body.discard];
      const newEquipped =
        rows[0]?.equipped_item === body.discard
          ? null
          : (rows[0]?.equipped_item ?? null);
      await pool.query(
        `UPDATE gcc_world.clients
           SET inventory = $1::jsonb, equipped_item = $2
         WHERE id = $3`,
        [JSON.stringify(inv), newEquipped, me.id],
      );
      return NextResponse.json({ ok: true, inventory: inv, equipped: newEquipped });
    }

    const { equipped } = body;
    const value =
      equipped === null
        ? null
        : typeof equipped === 'string' && equipped.length > 0
          ? equipped
          : null;
    await pool.query(
      `UPDATE gcc_world.clients SET equipped_item = $1 WHERE id = $2`,
      [value, me.id],
    );
    return NextResponse.json({ ok: true, equipped: value });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
