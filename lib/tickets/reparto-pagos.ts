import { pool } from '@/lib/db';
import { marcarRegistrosFacturados, REGISTRO_SIN_FACTURAR_SQL } from '@/lib/tickets/facturacion';

/**
 * ⇒ LO QUE SE PAGA SE REPARTE SOBRE LOS REQUERIMIENTOS (Fernando, 2026-11-12).
 *
 * El cliente elige en el enlace CÓMO paga —completo, por etapas o por requerimientos— y lo pagado
 * llena los requerimientos (en un ticket, sus registros de trabajo) de MÁS ANTIGUO A MÁS NUEVO:
 *  1. Cada requerimiento que cabe ENTERO en lo que queda se marca pagado.
 *  2. El que no cabe se salta y se mira si cabe alguno más pequeño de los siguientes.
 *  3. Lo que sobra al final va como ABONO PARCIAL al primero que no cupo («pagado $100 de $200»).
 * Pagar marca «pagado», no «completado»: algo se puede pagar antes de terminarlo.
 *
 * Cuánto ha recibido cada registro vive en `ticket_registro_pagos` (una fila por cobro y registro).
 * Un registro ENTERO además queda atado a la factura (`ticket_actions.invoice_id`), como siempre: así
 * lo ve todo lo que ya miraba «facturado». Los registros facturados antes de esto (sin filas aquí)
 * cuentan como pagados enteros.
 */

const MARGEN = 0.005;
const r2 = (n: number) => Math.round(n * 100) / 100;

let preparada: Promise<unknown> | null = null;
export const prepararRepartoPagos = () => (preparada ??= pool.query(`
  CREATE TABLE IF NOT EXISTS gcc_world.ticket_registro_pagos (
    id BIGSERIAL PRIMARY KEY,
    intent_id BIGINT,
    action_id INT NOT NULL,
    monto NUMERIC(12,2) NOT NULL,
    invoice_id INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_ticket_registro_pagos_action ON gcc_world.ticket_registro_pagos (action_id);
  ALTER TABLE gcc_world.payment_intents ADD COLUMN IF NOT EXISTS seleccion JSONB;
`).catch((e: unknown) => { preparada = null; throw e; }));

/** Lo que eligió el cliente en el enlace. Sin ella, el cobro es el de siempre (una etapa o todo). */
export type SeleccionCobro =
  | { modo: 'etapas'; etapas: number[] }
  | { modo: 'requerimientos'; requerimientos: number[] };

/** Limpia lo que llega del navegador: solo ids enteros, sin repetir, y un modo conocido. */
export function leerSeleccion(v: any): SeleccionCobro | null {
  if (!v || typeof v !== 'object') return null;
  const ids = (a: any) => Array.from(new Set((Array.isArray(a) ? a : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))).slice(0, 200);
  if (v.modo === 'etapas') { const e = ids(v.etapas); return e.length ? { modo: 'etapas', etapas: e } : null; }
  if (v.modo === 'requerimientos') { const r = ids(v.requerimientos); return r.length ? { modo: 'requerimientos', requerimientos: r } : null; }
  return null;
}

export type EstadoRegistro = {
  id: number; descripcion: string; fecha: string | null; costo: number;
  pagado: number; restante: number; estado: 'pagado' | 'parcial' | 'pendiente'; enMarcha: boolean;
};

/** Cada registro del ticket con lo que lleva pagado, de más antiguo a más nuevo. */
export async function estadoPagoRegistros(ticketId: string | number): Promise<EstadoRegistro[]> {
  await prepararRepartoPagos();
  const { rows } = await pool.query(
    `SELECT a.id, a.description, COALESCE(a.work_date::text, a.created_at::date::text) AS fecha,
            COALESCE(a.cost, 0)::float AS costo, (a.timer_started_at IS NOT NULL) AS en_marcha,
            NOT (${REGISTRO_SIN_FACTURAR_SQL('a')}) AS facturado,
            COALESCE((SELECT SUM(p.monto) FROM gcc_world.ticket_registro_pagos p
                       LEFT JOIN gcc_world.invoices i ON i.id = p.invoice_id
                      WHERE p.action_id = a.id AND (p.invoice_id IS NULL OR i.status IS DISTINCT FROM 'cancelled')), 0)::float AS abonado
       FROM gcc_world.ticket_actions a
      WHERE a.ticket_id = ($1)::int
      ORDER BY COALESCE(a.work_date, a.created_at::date), a.created_at, a.id`,
    [String(ticketId)],
  );
  return rows.map((x: any) => {
    const costo = r2(Number(x.costo) || 0);
    const pagado = x.facturado ? costo : Math.min(costo, r2(Number(x.abonado) || 0));
    const restante = r2(Math.max(0, costo - pagado));
    return {
      id: Number(x.id), descripcion: x.description || 'Registro', fecha: x.fecha, costo, pagado, restante,
      estado: restante <= MARGEN && costo > 0 ? 'pagado' : pagado > MARGEN ? 'parcial' : 'pendiente',
      enMarcha: !!x.en_marcha,
    };
  });
}

/**
 * EL REPARTO, sin base de datos (para poder probarlo). `registros` en su orden (el más antiguo
 * primero) con lo que les FALTA; `monto`, lo pagado sin recargo.
 */
export function repartir(registros: { id: number; restante: number }[], monto: number) {
  let queda = r2(monto);
  const completos: { id: number; monto: number }[] = [];
  const saltados: { id: number; restante: number }[] = [];
  for (const r of registros) {
    if (!(r.restante > MARGEN)) continue;
    if (r.restante <= queda + MARGEN) { completos.push({ id: r.id, monto: r.restante }); queda = r2(queda - r.restante); }
    else saltados.push(r);
  }
  let parcial: { id: number; monto: number } | null = null;
  if (queda > MARGEN && saltados.length) {
    const r = saltados[0];
    parcial = { id: r.id, monto: r2(Math.min(queda, r.restante)) };
    queda = r2(queda - parcial.monto);
  }
  return { completos, parcial, sobrante: Math.max(0, queda) };
}

/**
 * Reparte un cobro ya facturado sobre los registros del ticket y lo deja escrito.
 *  · Por requerimientos: van primero los elegidos (y en su caso cubren justo lo pagado).
 *  · Por etapas o una etapa: de más antiguo a más nuevo entre todos los pendientes.
 *  · «Todo lo pendiente» de siempre (sin selección ni etapa): todos quedan pagados, como antes —con
 *    un abono manual de por medio, el dinero no llega a cubrir sus costos y el reparto dejaría
 *    registros a medias en un ticket que ya no debe nada—.
 */
export async function repartirPagoEnRegistros(opts: {
  intentId: number; ticketId: string; neto: number; invoiceId: number;
  seleccion: SeleccionCobro | null; stageId: number | null;
}): Promise<void> {
  const { intentId, ticketId, neto, invoiceId, seleccion, stageId } = opts;
  const estado = (await estadoPagoRegistros(ticketId)).filter((r) => !r.enMarcha && r.restante > MARGEN);

  if (!seleccion && stageId == null) {
    for (const r of estado) {
      await pool.query(`INSERT INTO gcc_world.ticket_registro_pagos (intent_id, action_id, monto, invoice_id) VALUES ($1, $2, $3, $4)`,
        [intentId, r.id, r.restante, invoiceId]);
    }
    await marcarRegistrosFacturados(ticketId, invoiceId);
    return;
  }

  const elegidos = seleccion?.modo === 'requerimientos' ? new Set(seleccion.requerimientos) : null;
  const orden = elegidos ? [...estado.filter((r) => elegidos.has(r.id)), ...estado.filter((r) => !elegidos.has(r.id))] : estado;
  const { completos, parcial } = repartir(orden, neto);
  for (const c of [...completos, ...(parcial ? [parcial] : [])]) {
    await pool.query(`INSERT INTO gcc_world.ticket_registro_pagos (intent_id, action_id, monto, invoice_id) VALUES ($1, $2, $3, $4)`,
      [intentId, c.id, c.monto, invoiceId]);
  }
  if (completos.length) await marcarRegistrosFacturados(ticketId, invoiceId, completos.map((c) => c.id));
}
