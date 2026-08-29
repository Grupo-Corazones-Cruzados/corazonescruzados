/**
 * COMPRAR UNA AUTOMATIZACIÓN DEJA EL FLUJO LISTO Y EN MANOS DEL CLIENTE.
 *
 * ── QUÉ SE COMPRA EXACTAMENTE ─────────────────────────────────────────────────────────
 * Una automatización del marketplace no es una aplicación aparte —eso son los PRODUCTOS,
 * que tienen su propio servicio y su propio esquema—. Vive dentro de esta plataforma, en
 * el módulo de Automatizaciones. Lo que el cliente compra es **el derecho a usar un
 * flujo**, así que la compra tiene que dejarle ese flujo creado y con acceso.
 *
 * Si no, paga, ve el cargo en su tarjeta, entra a Automatizaciones y no hay nada. Y da
 * igual lo bien que funcione el cobro: para él la compra falló.
 *
 * ── LO QUE HACE ESTA FUNCIÓN, EN ORDEN ────────────────────────────────────────────────
 *  1. Mira **qué aprovisiona la ficha** (`flow_type` / `flow_category`). Si no aprovisiona
 *     nada, no hace nada: hay automatizaciones que se prestan como servicio y no crean
 *     flujo.
 *  2. Crea el flujo con el nombre de lo comprado y lo ata a su suscripción.
 *  3. Le da acceso al cliente que pagó.
 *
 * ── POR QUÉ NUNCA LANZA ───────────────────────────────────────────────────────────────
 * Corre justo después de cobrar. Si algo aquí reventara y tumbara la confirmación del
 * pago, el cliente tendría el dinero descontado y el cobro sin confirmar — el peor de los
 * dos mundos. Un fallo se registra y se arregla a mano creando el flujo; el dinero, no.
 */

import { pool } from '@/lib/db';
import { ensureUserClientAccount } from '@/lib/tickets/clientAccount';

/** Lo que declara la ficha del marketplace sobre el flujo que provisiona. */
interface Aprovisionable {
  titulo: string;
  flowType: string | null;
  flowCategory: string | null;
}

/**
 * Los tipos de flujo que existen. Se comprueba contra esta lista y no se confía en lo que
 * diga la ficha: un `flow_type` mal escrito crearía un flujo de un tipo que ninguna
 * pantalla sabe pintar, y el cliente entraría a una página en blanco.
 */
const TIPOS_VALIDOS = new Set(['email', 'whatsapp', 'ai_agent', 'custom']);

export async function aprovisionarAutomatizacion(opciones: {
  /** El ítem del portafolio que se compró. */
  itemId: string | number;
  /** La suscripción que acaba de crearse y que lo paga. */
  subscriptionId: string | number;
  /** El usuario que compró. De él sale la ficha de cliente a la que se le da acceso. */
  compradorUserId: string;
}): Promise<{ flowId: number } | null> {
  try {
    const { rows: [item] } = await pool.query<Aprovisionable>(
      `SELECT title AS titulo, flow_type AS "flowType", flow_category AS "flowCategory"
         FROM gcc_world.member_portfolio_items WHERE id = $1`,
      [opciones.itemId],
    );

    // No todas las automatizaciones crean flujo. Sin `flow_type` no hay nada que montar.
    if (!item?.flowType) return null;
    if (!TIPOS_VALIDOS.has(item.flowType)) {
      console.error('[automatizaciones] tipo de flujo desconocido en la ficha', opciones.itemId, item.flowType);
      return null;
    }

    /**
     * ⚠️ IDEMPOTENTE POR SUSCRIPCIÓN. Confirmar un pago puede repetirse —el webhook de la
     * pasarela reintenta, y una transferencia se confirma a mano sobre un cobro que quizá
     * ya se confirmó—. Sin esta comprobación, cada reintento le crearía al cliente otro
     * flujo idéntico y acabaría con tres «Chatbot Conversacional» en su lista.
     */
    const { rows: [existente] } = await pool.query(
      `SELECT id FROM gcc_world.flows WHERE subscription_id = $1 LIMIT 1`,
      [opciones.subscriptionId],
    );
    if (existente) return { flowId: Number(existente.id) };

    /**
     * Nace en **borrador**, no activo. Un flujo recién comprado no tiene nada configurado
     * —ni número conectado, ni conocimiento, ni listas— y arrancarlo solo serviría para
     * que empezara a fallar. Lo enciende su dueño cuando lo tenga listo.
     */
    const { rows: [flujo] } = await pool.query(
      `INSERT INTO gcc_world.flows (name, type, category, description, status, config, subscription_id)
       VALUES ($1, $2, $3, $4, 'draft', '{}'::jsonb, $5)
       RETURNING id`,
      [
        item.titulo,
        item.flowType,
        item.flowCategory || null,
        `Automatización contratada desde el marketplace.`,
        opciones.subscriptionId,
      ],
    );
    const flowId = Number(flujo.id);

    /**
     * El acceso. `ensureUserClientAccount` resuelve —o crea— la ficha de cliente del
     * comprador: quien compra puede ser un cliente de siempre o alguien que entra hoy por
     * primera vez, y las dos cosas tienen que acabar igual.
     */
    const clientId = await ensureUserClientAccount(opciones.compradorUserId);
    if (clientId) {
      await pool.query(
        `INSERT INTO gcc_world.flow_clients (flow_id, client_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [flowId, clientId],
      );
    } else {
      // Sin ficha de cliente el flujo queda creado pero invisible para él. Se avisa fuerte:
      // es un caso de arreglar a mano, no de dejar pasar.
      console.error('[automatizaciones] flujo', flowId, 'creado SIN acceso: el comprador no tiene ficha de cliente');
    }

    return { flowId };
  } catch (err: any) {
    // Ver la cabecera: esto no puede tumbar la confirmación de un pago.
    console.error('[automatizaciones] no se pudo aprovisionar la compra', opciones.itemId, err?.message);
    return null;
  }
}
