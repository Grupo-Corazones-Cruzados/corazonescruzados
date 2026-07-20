import { pool } from '@/lib/db';

/**
 * Validación de recogida de objetos, en el servidor.
 *
 * Antes, `POST /api/world/inventory` aceptaba cualquier `{placementId, itemId}`
 * sin comprobar que ese objeto existiera en el mapa ni que el jugador estuviera
 * cerca. Mientras no hubo economía era inofensivo; con fichas canjeables por
 * productos reales sería regalar dinero desde la consola del navegador.
 *
 * La regla que lo cierra: el cliente dice QUÉ recoge (un identificador de
 * colocación) y el servidor decide QUÉ ES eso mirando el mapa. El `itemId` que
 * mande el cliente se ignora por completo.
 */

/** Distancia máxima, en tiles, entre el jugador y el objeto que recoge. */
const MAX_PICKUP_DISTANCE_TILES = 3;

export type PickupCheck =
  | { ok: true; itemId: string }
  | { ok: false; reason: 'unknown_scene' | 'unknown_placement' | 'too_far' | 'no_position' };

type ItemPlacement = { id: string; itemId: string; x: number; y: number };

/**
 * Comprueba que la colocación exista en el mapa indicado y que el jugador esté
 * lo bastante cerca. Devuelve el itemId REAL según el mapa.
 */
export async function validatePickup(
  clientId: number,
  sceneSlug: string,
  placementId: string,
): Promise<PickupCheck> {
  const { rows } = await pool.query(
    'SELECT items FROM gcc_world.world_maps WHERE name = $1 LIMIT 1',
    [sceneSlug],
  );
  if (rows.length === 0) return { ok: false, reason: 'unknown_scene' };

  const items: ItemPlacement[] = Array.isArray(rows[0].items) ? rows[0].items : [];
  const placement = items.find((p) => p && p.id === placementId);
  if (!placement || typeof placement.itemId !== 'string') {
    return { ok: false, reason: 'unknown_placement' };
  }

  // Proximidad, contra la última posición que el servidor conoce. No se usa la
  // posición que reporte el cliente: sería pedirle al atacante que se autorice.
  const prog = await pool.query(
    `SELECT scene_slug, pos_x, pos_y
       FROM gcc_world.player_progress
      WHERE client_id = $1`,
    [clientId],
  );
  const p = prog.rows[0];

  // Sin posición conocida no se puede afirmar que esté cerca. Se rechaza: ante
  // una recompensa canjeable por bienes reales, fallar cerrado es lo correcto.
  if (!p || p.pos_x == null || p.pos_y == null) {
    return { ok: false, reason: 'no_position' };
  }
  if (p.scene_slug !== sceneSlug) {
    return { ok: false, reason: 'too_far' };
  }

  const dx = Math.abs(Number(p.pos_x) - Number(placement.x));
  const dy = Math.abs(Number(p.pos_y) - Number(placement.y));
  if (Math.max(dx, dy) > MAX_PICKUP_DISTANCE_TILES) {
    return { ok: false, reason: 'too_far' };
  }

  return { ok: true, itemId: placement.itemId };
}

/**
 * Guarda la posición del jugador. La escribe el juego mientras se mueve, y es
 * la base de la comprobación de proximidad.
 *
 * Ojo con lo que esto SÍ y NO garantiza: un cliente manipulado puede declarar
 * la posición que quiera, así que esto no impide teletransportarse. Lo que sí
 * impide es recoger a distancia sin haber declarado nunca estar ahí, y deja el
 * rastro en `game_action_log` para detectar saltos imposibles después. La
 * validación de movimiento por velocidad máxima es el siguiente escalón, y
 * tiene sentido montarlo cuando exista la primera ficha con valor real.
 */
export async function savePosition(
  clientId: number,
  sceneSlug: string,
  x: number,
  y: number,
  facing?: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO gcc_world.player_progress (client_id, scene_slug, pos_x, pos_y, facing, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (client_id) DO UPDATE
        SET scene_slug = EXCLUDED.scene_slug,
            pos_x      = EXCLUDED.pos_x,
            pos_y      = EXCLUDED.pos_y,
            facing     = EXCLUDED.facing,
            updated_at = now()`,
    [clientId, sceneSlug, Math.round(x), Math.round(y), facing ?? null],
  );
}
