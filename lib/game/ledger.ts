import { pool } from '@/lib/db';

/**
 * Libro contable de las monedas del juego.
 *
 * Las fichas se canjean por productos y servicios reales y, a futuro, serán
 * transferibles entre usuarios. Eso las acerca más a un sistema de pagos que a
 * una puntuación, y de ahí salen las tres garantías que da este módulo:
 *
 *  1. Append-only: cada movimiento queda anotado y el saldo se deriva. Una
 *     disputa se puede auditar; una duplicación es detectable después.
 *  2. Idempotencia: reintentos, dobles clics y reenvíos de red no acuñan dos
 *     veces. Es responsabilidad de quien llama pasar una clave estable.
 *  3. Serialización: los movimientos concurrentes de un mismo usuario se
 *     ordenan bloqueando la fila de saldo, no confiando en la suerte.
 *
 * Nunca llames a esto con datos que vengan del cliente sin validar. El juego
 * envía ACCIONES ("hablé con el NPC 7"); el servidor decide el importe.
 */

export type Currency = 'ficha' | (string & {});

export type LedgerPost = {
  clientId: number;
  currency: Currency;
  /** Positivo acuña, negativo gasta. Nunca 0. */
  amount: number;
  /** Por qué se movió: 'quest_reward', 'purchase', 'transfer_in'… */
  reason: string;
  refType?: string | null;
  refId?: string | null;
  /**
   * Clave estable que identifica ESTE hecho, no esta petición. Dos intentos de
   * cobrar la misma recompensa deben compartir clave.
   * Ej.: `quest:${questId}:${clientId}`
   */
  idempotencyKey: string;
};

export type LedgerResult =
  | { ok: true; balance: number; applied: boolean }
  | { ok: false; error: 'insufficient_funds' | 'daily_cap' | 'unknown_currency'; balance: number };

/**
 * Registra un movimiento y devuelve el saldo resultante.
 *
 * `applied: false` significa que la clave de idempotencia ya existía: la
 * operación era un duplicado y no se volvió a aplicar. Para quien llama es un
 * caso de éxito, no un error.
 */
export async function postLedger(post: LedgerPost): Promise<LedgerResult> {
  const { clientId, currency, amount, reason, idempotencyKey } = post;
  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error('postLedger: amount debe ser un entero distinto de 0');
  }
  if (!idempotencyKey) {
    throw new Error('postLedger: idempotencyKey es obligatoria');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cur = await client.query(
      'SELECT code, daily_mint_cap FROM gcc_world.game_currencies WHERE code = $1',
      [currency],
    );
    if (cur.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'unknown_currency', balance: 0 };
    }

    // Crear la fila de saldo si no existe y bloquearla. El orden importa: se
    // bloquea ANTES de insertar el movimiento, para que dos peticiones
    // simultáneas del mismo usuario se serialicen aquí.
    await client.query(
      `INSERT INTO gcc_world.ledger_balances (client_id, currency, balance)
       VALUES ($1, $2, 0)
       ON CONFLICT (client_id, currency) DO NOTHING`,
      [clientId, currency],
    );
    const locked = await client.query(
      `SELECT balance FROM gcc_world.ledger_balances
        WHERE client_id = $1 AND currency = $2
        FOR UPDATE`,
      [clientId, currency],
    );
    const current = Number(locked.rows[0].balance);

    // ¿Ya se aplicó este mismo hecho antes?
    const dup = await client.query(
      'SELECT balance_after FROM gcc_world.ledger_entries WHERE idempotency_key = $1',
      [idempotencyKey],
    );
    if (dup.rowCount && dup.rowCount > 0) {
      await client.query('COMMIT');
      return { ok: true, balance: Number(dup.rows[0].balance_after), applied: false };
    }

    if (amount < 0 && current + amount < 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'insufficient_funds', balance: current };
    }

    // Techo diario de acuñación. Defiende contra repetir una misión legítima en
    // bucle, que es el ataque económico realista — no contra saldos inventados,
    // que ya los impide la autoridad del servidor.
    const cap = cur.rows[0].daily_mint_cap;
    if (amount > 0 && cap != null) {
      const minted = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
           FROM gcc_world.ledger_entries
          WHERE client_id = $1 AND currency = $2
            AND amount > 0
            AND created_at >= date_trunc('day', now())`,
        [clientId, currency],
      );
      if (Number(minted.rows[0].total) + amount > Number(cap)) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'daily_cap', balance: current };
      }
    }

    const next = current + amount;
    await client.query(
      `INSERT INTO gcc_world.ledger_entries
         (client_id, currency, amount, reason, ref_type, ref_id, idempotency_key, balance_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        clientId,
        currency,
        amount,
        reason,
        post.refType ?? null,
        post.refId ?? null,
        idempotencyKey,
        next,
      ],
    );
    await client.query(
      `UPDATE gcc_world.ledger_balances
          SET balance = $1, updated_at = now()
        WHERE client_id = $2 AND currency = $3`,
      [next, clientId, currency],
    );

    await client.query('COMMIT');
    return { ok: true, balance: next, applied: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Saldo actual. 0 si el usuario nunca movió esa moneda. */
export async function getBalance(clientId: number, currency: Currency = 'ficha'): Promise<number> {
  const { rows } = await pool.query(
    'SELECT balance FROM gcc_world.ledger_balances WHERE client_id = $1 AND currency = $2',
    [clientId, currency],
  );
  return rows[0] ? Number(rows[0].balance) : 0;
}

/** Movimientos recientes, para el historial visible al usuario y para soporte. */
export async function getLedgerHistory(clientId: number, limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, currency, amount, reason, ref_type, ref_id, balance_after, created_at
       FROM gcc_world.ledger_entries
      WHERE client_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [clientId, Math.min(limit, 200)],
  );
  return rows;
}

/**
 * Deja constancia de una acción del jugador, aceptada o rechazada.
 * Se registra desde el día uno porque este dato no se puede reconstruir
 * retroactivamente: si no se guarda ahora, no existirá nunca.
 */
export async function logAction(
  clientId: number | null,
  action: string,
  payload: unknown,
  accepted = true,
  rejectReason?: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO gcc_world.game_action_log (client_id, action, payload, accepted, reject_reason)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [clientId, action, JSON.stringify(payload ?? null), accepted, rejectReason ?? null],
    );
  } catch (err) {
    // El registro no debe tumbar la jugada. Se avisa y se sigue.
    console.error('logAction falló:', err instanceof Error ? err.message : err);
  }
}
