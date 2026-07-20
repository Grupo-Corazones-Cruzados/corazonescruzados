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
  | { ok: true; itemId: string; quantity: number }
  | { ok: false; reason: 'unknown_scene' | 'unknown_placement' | 'too_far' | 'no_position' };

/**
 * Comprueba que la colocación exista y que el jugador esté lo bastante cerca.
 * Devuelve el itemId REAL según el manifiesto, no el que diga el cliente.
 *
 * La fuente es `item_placements`, que se sincroniza desde el proyecto de Godot
 * (`scripts/sync-item-manifest.mjs`). Antes se leía de `world_maps`, pero los
 * mundos ya no viven en la base de datos: se diseñan en Godot y forman parte
 * del build. El manifiesto existe justamente para que el servidor conserve su
 * propia copia y pueda seguir validando sin fiarse del juego.
 */
export async function validatePickup(
  clientId: number,
  sceneSlug: string,
  placementId: string,
): Promise<PickupCheck> {
  const { rows } = await pool.query(
    `SELECT item_id, quantity, x, y
       FROM gcc_world.item_placements
      WHERE scene = $1 AND placement_id = $2
      LIMIT 1`,
    [sceneSlug, placementId],
  );
  const placement = rows[0];
  if (!placement) {
    // No se distingue "escena desconocida" de "objeto desconocido": para quien
    // sondea desde fuera, ambas son lo mismo y dar detalle solo ayuda a mapear
    // qué existe.
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

  return {
    ok: true,
    itemId: String(placement.item_id),
    quantity: Number(placement.quantity) || 1,
  };
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
