import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/world/auth';
import { validatePickup } from '@/lib/game/pickup';
import { logAction } from '@/lib/game/ledger';

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

/** Tope de tipos distintos en el inventario. Se aplica en el servidor: el
 *  cliente ya lo comprobaba, pero esa comprobación no vale como defensa. */
const MAX_INVENTORY_SLOTS = 10;

// POST: recoger un objeto colocado en el mapa.
// Body: { sceneSlug: string, placementId: string }
//
// El `itemId` YA NO se acepta del cliente: lo decide el servidor leyendo el
// mapa. Antes se confiaba en él, lo que permitía inventarse cualquier objeto.
export async function POST(req: Request) {
  try {
    const me = await getAuthedClient();
    if (!me)
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 },
      );
    const body = await req.json();
    const placementId = body?.placementId;
    const sceneSlug = body?.sceneSlug;
    if (typeof placementId !== 'string' || typeof sceneSlug !== 'string') {
      return NextResponse.json(
        { error: 'sceneSlug y placementId requeridos' },
        { status: 400 },
      );
    }

    const check = await validatePickup(me.id, sceneSlug, placementId);
    if (!check.ok) {
      await logAction(me.id, 'pickup', { sceneSlug, placementId }, false, check.reason);
      return NextResponse.json({ error: 'Recogida no válida' }, { status: 403 });
    }
    const itemId = check.itemId;

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
    if (!(itemId in inv) && Object.keys(inv).length >= MAX_INVENTORY_SLOTS) {
      await logAction(me.id, 'pickup', { sceneSlug, placementId, itemId }, false, 'inventory_full');
      return NextResponse.json(
        { error: 'Inventario lleno', inventory: inv, pickedItems: picked },
        { status: 409 },
      );
    }
    // La cantidad la decide el manifiesto del servidor, no el cliente.
    inv[itemId] = (inv[itemId] ?? 0) + check.quantity;
    const newPicked = [...picked, placementId];
    await pool.query(
      `UPDATE gcc_world.clients
          SET inventory = $1::jsonb,
              picked_items = $2::jsonb
        WHERE id = $3`,
      [JSON.stringify(inv), JSON.stringify(newPicked), me.id],
    );
    // También se registran las recogidas ACEPTADAS, no solo los rechazos.
    // El valor del registro está en el flujo completo: sin los aciertos no se
    // puede distinguir a alguien que juega mucho de un script que repite una
    // acción legítima toda la noche, que es la amenaza económica real.
    await logAction(me.id, 'pickup', { sceneSlug, placementId, itemId, cantidad: check.quantity });

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
