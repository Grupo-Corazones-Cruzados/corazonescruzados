/**
 * EL INTENTO DE COBRO — donde se decide qué se cobra, cuánto, y qué pasa al confirmarse.
 *
 * Este archivo es la única puerta entre los tres canales (manual, cliente y enlace) y el
 * dinero. Los proveedores solo saben hablar con su pasarela; aquí es donde se calcula el
 * importe, se guarda el intento, y se emite la factura cuando —y solo cuando— el pago
 * está confirmado.
 *
 * Tres reglas que no se negocian, y el porqué de cada una:
 *
 * 1. **El importe NUNCA llega del navegador.** Se recalcula desde la etapa del plan cada
 *    vez. Un importe que viaja por el cliente es un importe que el cliente puede cambiar.
 *
 * 2. **La factura se emite al confirmarse el pago, jamás antes** (decisión de Fernando,
 *    2026-08-25). Una factura autorizada no se borra: se anula con nota de crédito. Emitir
 *    antes de cobrar convierte cada pago fallido en un trámite ante el SRI.
 *
 * 3. **Confirmar un pago es idempotente.** Kushki reintenta el webhook hasta 7 veces en
 *    3 horas si no recibe un 200. Sin idempotencia, el segundo intento emite un segundo
 *    comprobante del mismo cobro — y ese sí hay que anularlo con nota de crédito.
 */
import { pool } from '@/lib/db';
import { getProjectBilling, getTicketPayments } from '@/lib/payments';
import { computePeriods } from '@/lib/subscriptions';
import { createManualInvoice, createManualInvoiceFromTicket, createManualInvoiceFromSubscription, sendInvoiceToSri } from '@/lib/integrations/sri';
import { addInvoiceIncomeToFinance, addSubscriptionIncomeToFinance } from '@/lib/finance';
import { upsertBillingForClient } from '@/lib/billing-clients';
import { sendPaidInvoiceEmail } from '@/lib/integrations/email';
import { calcularRecargo, tarifaDe, CONCEPTO_RECARGO } from './comision';
import { FORMA_PAGO_SRI, FORMA_PAGO_DEBITO, type MetodoPago } from './tipos';

export type CanalCobro = 'manual' | 'client' | 'link';

export type DatosFacturacion = {
  id_type: string;
  ruc: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
};

/** Los orígenes que se pueden cobrar en línea hoy. */
export type OrigenCobro = 'project' | 'ticket' | 'subscription';

/**
 * El identificador de un mes de suscripción: `<idSuscripción>-<YYYY-MM>`.
 *
 * ⚠️ NO es una invención de este archivo: es **exactamente** el `source_id` que ya usan las
 * facturas de suscripción (`createManualInvoiceFromSubscription`) y el registro de ingresos
 * (`addSubscriptionIncomeToFinance`) desde 2026-06-11. Reutilizarlo hace que el cobro, la
 * factura y el ingreso de un mes hablen del mismo identificador — y de paso, que el candado
 * `idx_payment_intents_origen_pagado` proteja **cada mes por separado** sin migración nueva.
 */
export function idMesSuscripcion(subId: string | number, periodo: string): string {
  if (!/^\d{4}-\d{2}$/.test(periodo)) throw new Error('Periodo inválido (se espera AAAA-MM).');
  return `${subId}-${periodo}`;
}

/** Descompone `<idSuscripción>-<YYYY-MM>`. Lo necesita el enlace de pago, que solo guarda el id. */
export function partesMesSuscripcion(sourceId: string): { subId: string; periodo: string } {
  const m = /^(\d+)-(\d{4}-\d{2})$/.exec(sourceId);
  if (!m) throw new Error('Identificador de suscripción inválido.');
  return { subId: m[1], periodo: m[2] };
}

/**
 * Lo que se va a cobrar, venga de un proyecto o de un ticket.
 *
 * Un solo tipo para los dos a propósito: desde aquí hacia arriba —crear el intento,
 * confirmarlo, emitir la factura, la pantalla, el enlace— **nada distingue el origen**. Si
 * cada uno tuviera su tipo, tendríamos dos caminos paralelos que se separan en el primer
 * arreglo, y el que se quede atrás será el que cobre mal.
 */
export type Cobrable = {
  sourceType: OrigenCobro;
  sourceId: string;
  /** Título de lo que se cobra (el proyecto o el ticket), para la factura y la pantalla. */
  title: string;
  /** La etapa del plan. `null` en tickets, que se cobran enteros. */
  stageId: number | null;
  /** Nombre del concepto: la etapa, o el propio ticket. */
  conceptName: string;
  neto: number;
  recargo: number;
  total: number;
  proveedor: string;
};

/** Alias histórico: el cobro de una etapa de proyecto es un `Cobrable` como cualquier otro. */
export type EtapaCobrable = Cobrable & { projectId: number; projectTitle: string };

/**
 * Qué cuesta cobrar esta etapa por esta pasarela.
 *
 * Lanza si la etapa no existe o ya está facturada. Comprobarlo aquí y no en la pantalla
 * es lo que impide que dos personas —o dos pestañas— cobren la misma etapa: entre abrir
 * la página y pulsar «pagar» puede haber pasado cualquier cosa.
 */
export async function cotizarEtapa(
  projectId: string | number,
  stageId: number,
  proveedor: string,
): Promise<EtapaCobrable> {
  const billing = await getProjectBilling(projectId);
  if (!billing) throw new Error('El proyecto no existe.');
  if (billing.mode !== 'etapas') {
    throw new Error('Este proyecto no tiene plan de etapas. El cobro en línea solo cubre proyectos con plan.');
  }
  const etapa = billing.etapas.find(e => e.id === Number(stageId));
  if (!etapa) throw new Error('La etapa no pertenece a este proyecto.');
  if (etapa.invoiceId) {
    throw new Error(`La etapa «${etapa.name}» ya está facturada (${etapa.invoiceNumber}).`);
  }
  if (!(etapa.amount > 0)) throw new Error(`La etapa «${etapa.name}» no tiene importe.`);

  const { neto, recargo, total } = calcularRecargo(etapa.amount, tarifaDe(proveedor));
  return {
    sourceType: 'project',
    sourceId: String(billing.projectId),
    title: billing.title,
    stageId: etapa.id,
    conceptName: etapa.name,
    neto, recargo, total, proveedor,
    projectId: billing.projectId,
    projectTitle: billing.title,
  };
}

/**
 * Qué cuesta cobrar un TICKET por esta pasarela.
 *
 * ⚠️ Un ticket no tiene etapas: se cobra **el saldo que le queda por facturar**, entero y
 * una sola vez. El «abono parcial» sigue existiendo por el canal manual, donde lo controla
 * una persona; abrirlo a la pasarela obligaría a renunciar al candado que impide cobrarle
 * dos veces a quien hace doble clic (ver migración 054).
 *
 * Y se exige que esté **completado**: cobrarle a un cliente por un trabajo que todavía no
 * se entregó es justo lo que la facturación por etapas evita en los proyectos.
 */
export async function cotizarTicket(
  ticketId: string | number,
  proveedor: string,
): Promise<Cobrable> {
  const { rows: [t] } = await pool.query(
    `SELECT id, title, status, estimated_cost FROM gcc_world.tickets WHERE id = $1`,
    [ticketId],
  );
  if (!t) throw new Error('El ticket no existe.');
  if (t.status !== 'completed') {
    throw new Error('Este ticket todavía no está completado, así que no se puede cobrar.');
  }

  const pagos = await getTicketPayments(ticketId);
  if (!(pagos.pending > 0)) {
    throw new Error(pagos.invoiced > 0
      ? 'Este ticket ya está facturado por completo.'
      : 'Este ticket no tiene importe por cobrar.');
  }

  const yaPagado = await cobroPagadoDeOrigen('ticket', String(ticketId));
  if (yaPagado) throw new Error('Este ticket ya fue pagado en línea.');

  const { neto, recargo, total } = calcularRecargo(pagos.pending, tarifaDe(proveedor));
  return {
    sourceType: 'ticket',
    sourceId: String(t.id),
    title: t.title,
    stageId: null,
    conceptName: t.title,
    neto, recargo, total, proveedor,
  };
}

/**
 * Un cobro ya pagado de esta etapa, si lo hay.
 *
 * Se consulta ANTES de crear nada. El índice único de la base es el candado final, pero
 * chocar contra él devuelve un error feo al cliente; preguntar primero permite decirle
 * «esto ya está pagado» en vez de «error de restricción única».
 */
/**
 * Qué cuesta pagar UN MES de una suscripción.
 *
 * ⚠️ El `monthly_cost` de una suscripción es el **precio final, con su IVA ya dentro** (así
 * se guarda desde 2026-06-11: el emisor lo desglosa hacia atrás al facturar). Por eso el
 * neto de este cobro es el `monthly_cost` tal cual — sumarle IVA aquí lo cobraría dos veces.
 *
 * Solo se cobran meses que ya tocan: `computePeriods` los calcula desde la fecha de inicio,
 * y pedir uno futuro es un error, no un adelanto.
 */
export async function cotizarSuscripcion(
  subId: string | number,
  periodo: string,
  proveedor: string,
): Promise<Cobrable> {
  const { rows: [sub] } = await pool.query(
    `SELECT id, title, monthly_cost, start_date, status FROM gcc_world.subscriptions WHERE id = $1`,
    [subId],
  );
  if (!sub) throw new Error('La suscripción no existe.');
  if (sub.status === 'cancelled') throw new Error('Esta suscripción está cancelada.');

  const periodos = computePeriods(sub.start_date, []);
  const mes = periodos.find(p => p.period === periodo);
  if (!mes) throw new Error('Ese mes todavía no corresponde a esta suscripción.');

  const { rows: [yaMarcado] } = await pool.query(
    `SELECT paid, invoice_id FROM gcc_world.subscription_payments
      WHERE subscription_id = $1 AND period = $2`,
    [subId, `${periodo}-01`],
  );
  if (yaMarcado?.paid) throw new Error(`El mes de ${mes.label} ya está pagado.`);

  const sourceId = idMesSuscripcion(sub.id, periodo);
  const yaPagado = await cobroPagadoDeOrigen('subscription', sourceId);
  if (yaPagado) throw new Error(`El mes de ${mes.label} ya fue pagado en línea.`);

  const neto = Number(sub.monthly_cost) || 0;
  if (!(neto > 0)) throw new Error('Esta suscripción no tiene importe mensual.');

  const { recargo, total } = calcularRecargo(neto, tarifaDe(proveedor));
  return {
    sourceType: 'subscription',
    sourceId,
    title: sub.title,
    stageId: null,
    conceptName: `${sub.title} — ${mes.label}`,
    neto, recargo, total, proveedor,
  };
}

/**
 * LA PUERTA ÚNICA para cotizar cualquier cosa cobrable.
 *
 * Los endpoints no eligen entre `cotizarEtapa` y `cotizarTicket`: piden «cotiza esto» y el
 * despacho vive aquí. Es lo que mantiene a `/api/pagos/etapa`, `/api/pagos/cobrar`, los dos
 * generadores de enlaces y la pantalla **ciegos al origen** — y por tanto imposibles de
 * dejar a medias cuando entre el tercero (productos, automatizaciones).
 */
export async function cotizarCobro(
  destino: { sourceType: OrigenCobro; sourceId: string; stageId: number | null },
  proveedor: string,
): Promise<Cobrable> {
  if (destino.sourceType === 'subscription') {
    const { subId, periodo } = partesMesSuscripcion(destino.sourceId);
    return cotizarSuscripcion(subId, periodo, proveedor);
  }
  if (destino.sourceType === 'ticket') return cotizarTicket(destino.sourceId, proveedor);
  if (destino.stageId == null) throw new Error('Falta la etapa del proyecto.');
  return cotizarEtapa(destino.sourceId, destino.stageId, proveedor);
}

/** Si eso ya se pagó, venga de donde venga. */
export async function cobroPagadoDe(
  destino: { sourceType: string; sourceId: string; stageId: number | null },
): Promise<{ id: number; invoice_id: number | null } | null> {
  return destino.stageId != null
    ? cobroPagadoDeEtapa(destino.stageId)
    : cobroPagadoDeOrigen(destino.sourceType, destino.sourceId);
}

export async function cobroPagadoDeOrigen(
  sourceType: string, sourceId: string,
): Promise<{ id: number; invoice_id: number | null } | null> {
  const { rows } = await pool.query(
    `SELECT id, invoice_id FROM gcc_world.payment_intents
      WHERE source_type = $1 AND source_id = $2 AND stage_id IS NULL AND status = 'paid' LIMIT 1`,
    [sourceType, sourceId],
  );
  return rows[0] || null;
}

export async function cobroPagadoDeEtapa(stageId: number): Promise<{ id: number; invoice_id: number | null } | null> {
  const { rows } = await pool.query(
    `SELECT id, invoice_id FROM gcc_world.payment_intents
      WHERE stage_id = $1 AND status = 'paid' LIMIT 1`,
    [stageId],
  );
  return rows[0] || null;
}

export async function crearIntento(opts: {
  etapa: Cobrable;
  canal: CanalCobro;
  facturacion: DatosFacturacion;
  payerEmail: string;
  createdBy?: number | null;
}): Promise<{ id: number; total: number; neto: number; recargo: number }> {
  const { etapa, canal, facturacion, payerEmail, createdBy } = opts;

  const yaPagada = etapa.stageId != null
    ? await cobroPagadoDeEtapa(etapa.stageId)
    : await cobroPagadoDeOrigen(etapa.sourceType, etapa.sourceId);
  if (yaPagada) {
    throw new Error(etapa.stageId != null ? 'Esta etapa ya fue pagada.' : 'Esto ya fue pagado.');
  }

  // ⚠️ SE REUTILIZA EL INTENTO VIVO EN VEZ DE APILAR OTRO.
  //
  // Corregir un dato y volver a pulsar «Continuar al pago» es lo más normal del mundo: en el
  // primer cobro real, Fernando empezó con su cédula, cambió a Consumidor Final y volvió a
  // pulsar. Sin esto, cada intento deja una fila más en `processing` que nunca se cierra, y
  // el histórico de cobros acaba lleno de fantasmas que hay que interpretar cada vez que se
  // audita un pago.
  //
  // Solo se reutiliza el que **todavía no ha llegado a la pasarela** (`provider_reference IS
  // NULL`): en cuanto la pasarela conoce una referencia, ese intento es suyo y no se toca.
  const { rows: [vivo] } = await pool.query(
    `UPDATE gcc_world.payment_intents
        SET billing_snapshot = $3, payer_email = $4, net_amount = $5, fee_amount = $6,
            charge_amount = $7, provider = $8, channel = $9, status = 'pending',
            provider_status = NULL, failure_reason = NULL, updated_at = NOW()
      WHERE id = (
        SELECT id FROM gcc_world.payment_intents
         WHERE source_id = $2 AND source_type = $10
           AND stage_id IS NOT DISTINCT FROM $1
           AND status IN ('pending','processing')
           AND provider_reference IS NULL
         ORDER BY id DESC LIMIT 1
      )
      RETURNING id`,
    [
      etapa.stageId, etapa.sourceId, JSON.stringify(facturacion), payerEmail,
      etapa.neto, etapa.recargo, etapa.total, etapa.proveedor, canal, etapa.sourceType,
    ],
  );
  if (vivo) {
    return { id: Number(vivo.id), total: etapa.total, neto: etapa.neto, recargo: etapa.recargo };
  }

  const { rows: [fila] } = await pool.query(
    `INSERT INTO gcc_world.payment_intents
       (source_type, source_id, stage_id, channel, provider,
        net_amount, fee_amount, charge_amount, billing_snapshot, payer_email, created_by)
     VALUES ($11, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      etapa.sourceId, etapa.stageId, canal, etapa.proveedor,
      etapa.neto, etapa.recargo, etapa.total,
      JSON.stringify(facturacion), payerEmail, createdBy ?? null, etapa.sourceType,
    ],
  );
  return { id: Number(fila.id), total: etapa.total, neto: etapa.neto, recargo: etapa.recargo };
}

/** Deja constancia de lo que dijo el proveedor al iniciar el cobro. */
export async function anotarRespuestaProveedor(
  intentId: number,
  datos: { referencia?: string | null; metodo?: MetodoPago | null; estado?: string | null; fallo?: string | null; procesando?: boolean },
): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.payment_intents
        SET provider_reference = COALESCE($2, provider_reference),
            provider_method    = COALESCE($3, provider_method),
            provider_status    = COALESCE($4, provider_status),
            failure_reason     = COALESCE($5, failure_reason),
            status = CASE
                       WHEN status = 'paid' THEN status
                       WHEN $6::boolean THEN 'processing'
                       WHEN $5 IS NOT NULL THEN 'failed'
                       ELSE status
                     END,
            updated_at = NOW()
      WHERE id = $1`,
    [intentId, datos.referencia ?? null, datos.metodo ?? null, datos.estado ?? null,
     datos.fallo ?? null, datos.procesando ?? false],
  );
}

export type ResultadoConfirmacion = {
  intentId: number;
  invoiceId: number | null;
  yaEstaba: boolean;
  autorizada: boolean;
  error?: string;
};

/**
 * CONFIRMA UN PAGO Y EMITE SU FACTURA. Es el único sitio del sistema que lo hace.
 *
 * El candado es el `UPDATE ... WHERE status <> 'paid'`: Postgres bloquea la fila mientras
 * dura, así que de dos webhooks simultáneos solo uno se lleva la fila y el otro sale por
 * `yaEstaba`. Comprobar-y-luego-escribir en dos consultas dejaría el hueco justo por el
 * que se cuela el comprobante duplicado.
 */
export async function confirmarPago(
  intentId: number,
  datos: { referencia?: string | null; metodo?: MetodoPago | null; estadoProveedor?: string | null; esDebito?: boolean },
): Promise<ResultadoConfirmacion> {
  const { rows: [intento] } = await pool.query(
    `UPDATE gcc_world.payment_intents
        SET status = 'paid',
            paid_at = NOW(),
            provider_reference = COALESCE($2, provider_reference),
            provider_method    = COALESCE($3, provider_method),
            provider_status    = COALESCE($4, provider_status),
            updated_at = NOW()
      WHERE id = $1 AND status <> 'paid'
      RETURNING *`,
    [intentId, datos.referencia ?? null, datos.metodo ?? null, datos.estadoProveedor ?? null],
  );

  if (!intento) {
    // Ya estaba pagado: puede ser un reintento del webhook (lo normal) o una carrera.
    // En ninguno de los dos casos se emite nada nuevo — se devuelve la factura que ya hay.
    const { rows: [previo] } = await pool.query(
      `SELECT id, invoice_id FROM gcc_world.payment_intents WHERE id = $1`, [intentId],
    );
    if (!previo) throw new Error(`El cobro ${intentId} no existe.`);
    return { intentId, invoiceId: previo.invoice_id ?? null, yaEstaba: true, autorizada: false };
  }

  // Si ya tenía factura (no debería, pero el dinero merece cinturón y tirantes), no se
  // emite otra.
  if (intento.invoice_id) {
    return { intentId, invoiceId: Number(intento.invoice_id), yaEstaba: true, autorizada: false };
  }

  // ⚠️ MODO ENSAYO — la salvaguarda que separa «probar el cobro» de «emitir un comprobante».
  //
  // Con la aplicación de PayPhone en ambiente de PRUEBAS, sus pagos son ficticios… pero la
  // factura la emite NUESTRO sistema, y esa sale de verdad, con su numeración y su
  // autorización del SRI. Una factura autorizada no se borra: se anula con nota de crédito.
  // Es decir, probar el flujo completo sin esta salvaguarda ensucia la numeración fiscal
  // real, y cada ensayo cuesta un trámite.
  //
  // Con `PAGOS_EMITIR_FACTURA=0` el cobro se registra entero —queda `paid`, con su
  // referencia y su importe— y **solo se omite la emisión**. Así se puede recorrer el
  // camino de punta a punta y comprobar que todo cuadra, sin tocar el SRI.
  if (process.env.PAGOS_EMITIR_FACTURA === '0') {
    await pool.query(
      `UPDATE gcc_world.payment_intents
          SET failure_reason = 'ENSAYO: cobro registrado, factura NO emitida (PAGOS_EMITIR_FACTURA=0).',
              updated_at = NOW()
        WHERE id = $1`,
      [intentId],
    );
    console.warn(`[pagos] ENSAYO: el cobro ${intentId} quedó pagado SIN emitir factura.`);
    return { intentId, invoiceId: null, yaEstaba: false, autorizada: false };
  }

  try {
    const resultado = await emitirFacturaDelCobro(intento, datos.esDebito === true);
    return { intentId, invoiceId: resultado.invoiceId, yaEstaba: false, autorizada: resultado.autorizada };
  } catch (err: any) {
    // ⚠️ EL COBRO NO SE REVIERTE. El dinero entró de verdad; que la emisión falle es un
    // problema nuestro, no del cliente. Queda `paid` con el motivo escrito para poder
    // reintentar la emisión, que es reversible. Devolver el dinero, no.
    await pool.query(
      `UPDATE gcc_world.payment_intents SET failure_reason = $2, updated_at = NOW() WHERE id = $1`,
      [intentId, `Cobrado, pero la factura falló: ${err.message}`],
    );
    console.error(`[pagos] cobro ${intentId} cobrado sin factura:`, err.message);
    return { intentId, invoiceId: null, yaEstaba: false, autorizada: false, error: err.message };
  }
}

/**
 * Emite la factura de un cobro confirmado.
 *
 * Dos líneas, siempre: la etapa por su importe pactado y el recargo aparte. Fernando eligió
 * esa forma el 2026-08-25 y no es solo estética — la tarjeta de Pagos del proyecto calcula
 * «por facturar» restando el total de las facturas al costo, así que si el recargo fuera
 * dentro del precio de la etapa el proyecto se daría por facturado antes de tiempo.
 */
async function emitirFacturaDelCobro(intento: any, esDebito: boolean): Promise<{ invoiceId: number; autorizada: boolean }> {
  const facturacion: DatosFacturacion = typeof intento.billing_snapshot === 'string'
    ? JSON.parse(intento.billing_snapshot)
    : intento.billing_snapshot;
  if (!facturacion?.name) throw new Error('El cobro no guardó datos de facturación.');

  const neto = Number(intento.net_amount) || 0;
  const recargo = Number(intento.fee_amount) || 0;
  const sourceType: string = intento.source_type;
  const sourceId = String(intento.source_id);
  const stageId = intento.stage_id != null ? Number(intento.stage_id) : null;
  const esTicket = sourceType === 'ticket';
  const esSuscripcion = sourceType === 'subscription';

  let titulo = esTicket ? 'Ticket' : esSuscripcion ? 'Suscripción' : 'Proyecto';
  let nombreEtapa = titulo;
  let subId = '';
  let periodo = '';
  let ivaSuscripcion = 0;
  if (esSuscripcion) {
    ({ subId, periodo } = partesMesSuscripcion(sourceId));
    const { rows: [sub] } = await pool.query(
      `SELECT title, iva_rate, start_date FROM gcc_world.subscriptions WHERE id = $1`, [subId]);
    titulo = sub?.title || `Suscripción ${subId}`;
    ivaSuscripcion = Number(sub?.iva_rate) || 0;
    const mes = computePeriods(sub?.start_date, []).find(p => p.period === periodo);
    nombreEtapa = `${titulo} — ${mes?.label || periodo}`;
  } else if (esTicket) {
    const { rows: [t] } = await pool.query(`SELECT title FROM gcc_world.tickets WHERE id = $1`, [sourceId]);
    titulo = t?.title || `Ticket ${sourceId}`;
    nombreEtapa = titulo;
  } else {
    const billing = await getProjectBilling(sourceId);
    const etapa = billing?.etapas.find(e => e.id === stageId);
    titulo = billing?.title || 'Proyecto';
    nombreEtapa = etapa?.name || `Etapa ${stageId}`;
  }

  // ⚠️ EL IMPORTE DE UNA SUSCRIPCIÓN LLEVA SU IVA DENTRO. `monthly_cost` es el precio final
  // (así se guarda desde 2026-06-11), así que la línea va con la base desglosada hacia atrás
  // — exactamente como lo hace «Marcar pagado». Si se pasara el total como base, el
  // comprobante saldría por más de lo cobrado. Con `iva_rate = 0`, que es lo que usa GCC
  // hoy, base y total coinciden.
  const baseSuscripcion = ivaSuscripcion > 0 ? neto / (1 + ivaSuscripcion / 100) : neto;

  const items = [
    {
      description: esSuscripcion ? nombreEtapa : esTicket ? titulo : `${titulo} — ${nombreEtapa}`,
      quantity: 1,
      unitPrice: esSuscripcion ? baseSuscripcion : neto,
      ivaRate: esSuscripcion ? ivaSuscripcion : 0,
      discount: 0,
    },
  ];
  // El recargo de la pasarela va SIEMPRE a tarifa 0: es un gasto de procesamiento, no parte
  // del servicio suscrito, y no hereda el IVA de lo que se está cobrando.
  if (recargo > 0) {
    items.push({ description: CONCEPTO_RECARGO, quantity: 1, unitPrice: recargo, ivaRate: 0, discount: 0 });
  }

  // La forma de pago del XML deja de ser una elección de pantalla: la pone el método con
  // el que el cliente pagó de verdad.
  const metodo = (intento.provider_method as MetodoPago) || 'card';
  const paymentCode = metodo === 'card' && esDebito ? FORMA_PAGO_DEBITO : FORMA_PAGO_SRI[metodo];

  // ⚠️ Cada origen usa SU emisor, y no es intercambiable: el de ticket enlaza la factura
  // por `source_type`/`source_id` —que es lo que hace que anular la factura devuelva el
  // ticket a facturable— y el de proyecto marca la etapa del plan. Emitir un ticket con el
  // emisor de proyectos dejaría la factura sin origen y rompería la anulación.
  const { invoiceId } = esSuscripcion
    ? await createManualInvoiceFromSubscription({
        subscriptionId: subId,
        period: periodo,
        title: titulo,
        clientIdType: facturacion.id_type,
        clientName: facturacion.name,
        clientRuc: facturacion.ruc,
        clientEmail: facturacion.email,
        clientPhone: facturacion.phone || '',
        clientAddress: facturacion.address || '',
        paymentCode,
        invoiceItems: items,
        currency: 'USD',
        exchangeRate: 1,
      })
    : esTicket
    ? await createManualInvoiceFromTicket({
        ticketId: sourceId,
        ticketTitle: titulo,
        clientIdType: facturacion.id_type,
        clientName: facturacion.name,
        clientRuc: facturacion.ruc,
        clientEmail: facturacion.email,
        clientPhone: facturacion.phone || '',
        clientAddress: facturacion.address || '',
        paymentCode,
        invoiceItems: items,
        currency: 'USD',
        exchangeRate: 1,
      })
    : await createManualInvoice({
        projectIds: [sourceId],
        clientIdType: facturacion.id_type,
        clientName: facturacion.name,
        clientRuc: facturacion.ruc,
        clientEmail: facturacion.email,
        clientPhone: facturacion.phone || '',
        clientAddress: facturacion.address || '',
        paymentCode,
        invoiceItems: items,
        stageIds: stageId != null ? [String(stageId)] : [],
        currency: 'USD',
        exchangeRate: 1,
      });

  // El vínculo en los dos sentidos: la factura sabe de qué cobro salió y el cobro sabe qué
  // factura emitió. Sin esto, conciliar contra la liquidación del proveedor es imposible.
  await pool.query(
    `UPDATE gcc_world.invoices SET payment_intent_id = $1, updated_at = NOW() WHERE id = $2`,
    [intento.id, invoiceId],
  );
  await pool.query(
    `UPDATE gcc_world.payment_intents SET invoice_id = $1, updated_at = NOW() WHERE id = $2`,
    [invoiceId, intento.id],
  );

  // Enlaza la factura con el cliente del proyecto y guarda su cuenta de facturación, igual
  // que hace el canal manual. Una cuenta por cliente: Fernando lo confirmó el 2026-08-25.
  try {
    const { rows: [proj] } = await pool.query(
      esSuscripcion
        ? `SELECT client_id FROM gcc_world.subscriptions WHERE id = ($1)::bigint`
        : esTicket
        ? `SELECT client_id FROM gcc_world.tickets  WHERE id = ($1)::bigint`
        : `SELECT client_id FROM gcc_world.projects WHERE id = ($1)::bigint`,
      [esSuscripcion ? subId : sourceId],
    );
    if (proj?.client_id) {
      await pool.query(`UPDATE gcc_world.invoices SET client_id = $1 WHERE id = $2`, [proj.client_id, invoiceId]);
      await upsertBillingForClient(proj.client_id, facturacion);
    }
  } catch (e: any) {
    console.error('[pagos] no se pudo enlazar el cliente:', e.message);
  }

  const sri = await sendInvoiceToSri(invoiceId);

  // ⚠️ La factura nace PAGADA, y va después del SRI a propósito: `sendInvoiceToSri` mueve
  // el estado a 'failed' si el SRI rechaza, y hacerlo antes lo pisaría. El cobro ya
  // ocurrió, así que 'paid' es la verdad — salvo que el comprobante se caiga, y entonces
  // el estado tiene que gritarlo.
  if (sri?.authorized) {
    await pool.query(
      `UPDATE gcc_world.invoices SET status = 'paid', updated_at = NOW() WHERE id = $1 AND status <> 'cancelled'`,
      [invoiceId],
    );
  }

  // ⚠️ UNA SUSCRIPCIÓN TIENE QUE QUEDAR MARCADA COMO PAGADA EN SU PROPIA TABLA.
  //
  // El resto del módulo —el aviso de vencimiento, el color del mes, el «desmarcar»— no mira
  // `payment_intents`: mira `subscription_payments`. Sin esta fila, el cliente pagaría y su
  // mes seguiría saliendo en rojo como impago. Es la misma escritura que hace «Marcar
  // pagado», y por eso el `ON CONFLICT` respeta la clave (subscription_id, period).
  if (esSuscripcion && sri?.authorized) {
    try {
      await pool.query(
        `INSERT INTO gcc_world.subscription_payments
           (subscription_id, period, paid, paid_at, paid_by, invoice_id, amount)
         VALUES ($1, $2, true, NOW(), $3, $4, $5)
         ON CONFLICT (subscription_id, period)
         DO UPDATE SET paid = true, paid_at = NOW(), paid_by = EXCLUDED.paid_by,
                       invoice_id = EXCLUDED.invoice_id, amount = EXCLUDED.amount`,
        [subId, `${periodo}-01`, facturacion.email, invoiceId, neto],
      );
    } catch (e: any) {
      console.error(`[pagos] el mes ${periodo} se cobró pero no se marcó pagado:`, e.message);
      await pool.query(
        `UPDATE gcc_world.payment_intents SET failure_reason = $2 WHERE id = $1`,
        [intento.id, `Cobrado y facturado, pero el mes no quedó marcado: ${e.message}`],
      ).catch(() => {});
    }
  }

  // El ingreso se registra POR FACTURA, nunca por proyecto: con facturación parcial,
  // apuntar el costo entero haría que las etapas siguientes no sumaran nada, porque el
  // registro es único por origen. La suscripción es la excepción: usa SU propio origen
  // (`subscription`/`<id>-<periodo>`), que es el que sabe revertir la anulación de factura.
  try {
    if (esSuscripcion) {
      await addSubscriptionIncomeToFinance(sourceId, nombreEtapa, Number(intento.charge_amount) || 0, new Date());
    } else {
      await addInvoiceIncomeToFinance(String(invoiceId), `${nombreEtapa} — ${titulo}`, Number(intento.charge_amount) || 0);
    }
  } catch (e: any) {
    console.error('[pagos] no se pudo registrar el ingreso:', e.message);
  }

  // ⚠️ Y SE LE MANDA LA FACTURA, porque la pantalla se lo prometió.
  //
  // «La factura electrónica se emite con estos datos y te llega al correo en cuanto el pago
  // se confirme» — eso dice el formulario de pago. Este envío faltaba, y el hueco se vio en
  // el PRIMER cobro real: el comprobante se emitió y se autorizó, pero nadie se lo mandó al
  // cliente. Una promesa en pantalla es parte del trabajo, no decoración.
  //
  // Va en su propio `try`: si el correo falla, el cobro y la factura siguen siendo válidos.
  // Lo que no se puede es callarlo, así que queda en el registro.
  if (sri?.authorized) {
    try {
      const { rows: [inv] } = await pool.query(
        `SELECT invoice_number, authorization_number, total, pdf_data
           FROM gcc_world.invoices WHERE id = $1`,
        [invoiceId],
      );
      const pdf = inv?.pdf_data
        ? (Buffer.isBuffer(inv.pdf_data) ? inv.pdf_data : Buffer.from(inv.pdf_data))
        : null;
      const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org';
      await sendPaidInvoiceEmail({
        email: facturacion.email,
        projectTitle: titulo,
        stageName: nombreEtapa,
        invoiceNumber: inv?.invoice_number || `#${invoiceId}`,
        authorization: inv?.authorization_number || null,
        total: Number(inv?.total) || Number(intento.charge_amount) || 0,
        pdf,
        projectUrl: esSuscripcion ? null
          : esTicket ? `${base}/ticket/${sourceId}`
          : `${base}/proyecto/${sourceId}`,
      });
    } catch (e: any) {
      console.error(`[pagos] la factura ${invoiceId} se emitió pero el correo no salió:`, e.message);
      await pool.query(
        `UPDATE gcc_world.payment_intents
            SET failure_reason = 'Factura emitida, pero el correo al cliente no salió: ' || $2
          WHERE id = $1`,
        [intento.id, e.message],
      ).catch(() => {});
    }
  }

  return { invoiceId, autorizada: Boolean(sri?.authorized) };
}

/**
 * Guarda un evento del proveedor y dice si hay que procesarlo.
 *
 * El `UNIQUE (provider, event_id)` de la base hace el trabajo: si el evento ya estaba, el
 * INSERT no devuelve fila y el webhook responde 200 sin volver a tocar nada. Es la primera
 * de las dos barreras contra el comprobante duplicado; la segunda es el `confirmarPago`.
 */
export async function registrarEvento(
  provider: string,
  eventId: string,
  intentId: number | null,
  payload: unknown,
): Promise<boolean> {
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.payment_events (provider, event_id, intent_id, payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, event_id) DO NOTHING
     RETURNING id`,
    [provider, eventId, intentId, JSON.stringify(payload)],
  );
  return rows.length > 0;
}

export async function marcarEventoAtendido(provider: string, eventId: string, nota: string): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.payment_events SET handled = true, handled_note = $3
      WHERE provider = $1 AND event_id = $2`,
    [provider, eventId, nota.slice(0, 500)],
  );
}

/** Busca el intento al que se refiere un evento, por nuestro id o por la referencia del proveedor. */
export async function buscarIntento(
  provider: string,
  intentId: number | null,
  referencia: string | null,
): Promise<any | null> {
  if (intentId != null) {
    const { rows } = await pool.query(`SELECT * FROM gcc_world.payment_intents WHERE id = $1`, [intentId]);
    if (rows[0]) return rows[0];
  }
  if (referencia) {
    const { rows } = await pool.query(
      `SELECT * FROM gcc_world.payment_intents WHERE provider = $1 AND provider_reference = $2`,
      [provider, referencia],
    );
    if (rows[0]) return rows[0];
  }
  return null;
}

export async function marcarFallido(intentId: number, motivo: string): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.payment_intents
        SET status = CASE WHEN status = 'paid' THEN status ELSE 'failed' END,
            failure_reason = $2, updated_at = NOW()
      WHERE id = $1`,
    [intentId, motivo.slice(0, 500)],
  );
}
