import { pool } from '@/lib/db';

/**
 * Etapas del juego que se abren con resultados REALES registrados en la app.
 *
 * Es la idea más característica del proyecto: no se avanza solo jugando, se
 * avanza porque pasó algo de verdad en el dashboard. Por eso la regla vive en
 * datos (`game_stages.unlock_rule`) y no en código — las historias se pueden
 * definir sin desplegar.
 *
 * Regla de confianza: esto SIEMPRE se evalúa en el servidor contra las tablas
 * reales. El juego nunca informa de que cumplió una condición; pregunta qué
 * tiene abierto.
 */

export type UnlockRule =
  /** Se abre al haber cerrado N tickets. */
  | { kind: 'ticket_closed'; count: number }
  /** Se abre cuando el jugador tiene una bandera de mundo puesta. */
  | { kind: 'flag'; flag: string }
  /** Se abre al alcanzar cierto saldo acumulado de una moneda. */
  | { kind: 'balance'; currency: string; min: number }
  /** Siempre abierta. Útil para la etapa inicial. */
  | { kind: 'always' };

export type Stage = {
  slug: string;
  name: string;
  description: string | null;
  orderIdx: number;
  unlocked: boolean;
  unlockedAt: string | null;
  /** Qué falta para abrirla, en lenguaje mostrable al usuario. */
  pending: string | null;
};

/**
 * Comprueba una regla contra los datos reales y devuelve si se cumple, junto
 * con la evidencia concreta que lo demuestra (para poder responder "¿por qué
 * se me abrió?" cuando alguien reclame).
 */
async function checkRule(
  clientId: number,
  rule: UnlockRule,
): Promise<{ met: boolean; evidence: unknown; pending: string | null }> {
  switch (rule.kind) {
    case 'always':
      return { met: true, evidence: { kind: 'always' }, pending: null };

    case 'ticket_closed': {
      const need = Math.max(1, rule.count ?? 1);
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n
           FROM gcc_world.tickets
          WHERE client_id = $1 AND status = 'completed'`,
        [clientId],
      );
      const have = rows[0]?.n ?? 0;
      return {
        met: have >= need,
        evidence: { kind: 'ticket_closed', have, need },
        pending: have >= need ? null : `Cierra ${need - have} ticket(s) más.`,
      };
    }

    case 'flag': {
      const { rows } = await pool.query(
        'SELECT 1 FROM gcc_world.player_flags WHERE client_id = $1 AND flag = $2',
        [clientId, rule.flag],
      );
      const met = (rows.length ?? 0) > 0;
      return {
        met,
        evidence: { kind: 'flag', flag: rule.flag },
        pending: met ? null : 'Aún no descubierto.',
      };
    }

    case 'balance': {
      const { rows } = await pool.query(
        'SELECT balance FROM gcc_world.ledger_balances WHERE client_id = $1 AND currency = $2',
        [clientId, rule.currency],
      );
      const have = rows[0] ? Number(rows[0].balance) : 0;
      return {
        met: have >= rule.min,
        evidence: { kind: 'balance', have, need: rule.min },
        pending: have >= rule.min ? null : `Te faltan ${rule.min - have}.`,
      };
    }

    default:
      // Regla desconocida: no se abre. Fallar cerrado es lo correcto cuando de
      // por medio hay recompensas canjeables por bienes reales.
      return { met: false, evidence: null, pending: 'Regla no reconocida.' };
  }
}

/**
 * Evalúa todas las etapas para un jugador, registra las que acaban de abrirse
 * y devuelve el estado completo.
 *
 * El desbloqueo es permanente: una vez abierta, no se vuelve a cerrar aunque
 * la condición deje de cumplirse. Quitarle a alguien algo que ya se ganó es
 * peor que la inconsistencia.
 */
export async function evaluateStages(clientId: number): Promise<Stage[]> {
  const { rows: stages } = await pool.query(
    `SELECT slug, name, description, order_idx, unlock_rule
       FROM gcc_world.game_stages
      ORDER BY order_idx ASC, slug ASC`,
  );
  const { rows: unlockedRows } = await pool.query(
    'SELECT stage_slug, unlocked_at FROM gcc_world.player_stage_unlocks WHERE client_id = $1',
    [clientId],
  );
  const already = new Map<string, string>(
    unlockedRows.map((r: { stage_slug: string; unlocked_at: Date }) => [
      r.stage_slug,
      new Date(r.unlocked_at).toISOString(),
    ]),
  );

  const out: Stage[] = [];
  for (const s of stages) {
    const prior = already.get(s.slug);
    if (prior) {
      out.push({
        slug: s.slug,
        name: s.name,
        description: s.description,
        orderIdx: s.order_idx,
        unlocked: true,
        unlockedAt: prior,
        pending: null,
      });
      continue;
    }

    const { met, evidence, pending } = await checkRule(clientId, s.unlock_rule as UnlockRule);
    let unlockedAt: string | null = null;

    if (met) {
      const ins = await pool.query(
        `INSERT INTO gcc_world.player_stage_unlocks (client_id, stage_slug, evidence)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (client_id, stage_slug) DO NOTHING
         RETURNING unlocked_at`,
        [clientId, s.slug, JSON.stringify(evidence)],
      );
      unlockedAt = ins.rows[0]
        ? new Date(ins.rows[0].unlocked_at).toISOString()
        : new Date().toISOString();
    }

    out.push({
      slug: s.slug,
      name: s.name,
      description: s.description,
      orderIdx: s.order_idx,
      unlocked: met,
      unlockedAt,
      pending: met ? null : pending,
    });
  }
  return out;
}

/** Atajo para comprobar una sola etapa sin construir la lista completa. */
export async function isStageUnlocked(clientId: number, slug: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM gcc_world.player_stage_unlocks WHERE client_id = $1 AND stage_slug = $2',
    [clientId, slug],
  );
  if (rows.length > 0) return true;
  const stages = await evaluateStages(clientId);
  return stages.some((s) => s.slug === slug && s.unlocked);
}
