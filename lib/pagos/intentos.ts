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
import { aprovisionarAutomatizacion } from '@/lib/automatizaciones/aprovisionar';
import { getProjectBilling, getTicketPayments } from '@/lib/payments';
import { computePeriods } from '@/lib/subscriptions';
import { createManualInvoice, createManualInvoiceFromTicket, createManualInvoiceFromSubscription, sendInvoiceToSri } from '@/lib/integrations/sri';
import { addInvoiceIncomeToFinance, addSubscriptionIncomeToFinance } from '@/lib/finance';
import { upsertBillingForClient } from '@/lib/billing-clients';
import { sendPaidInvoiceEmail } from '@/lib/integrations/email';
import { calcularRecargo, tarifaDe, CONCEPTO_RECARGO } from './comision';
import { TARIFA_TRANSFERENCIA } from './cuentas';
import { FORMA_PAGO_SRI, FORMA_PAGO_DEBITO, type MetodoPago } from './tipos';

export type CanalCobro = 'manual' | 'client' | 'link';

export type DatosFacturacion = {
  /** Código del SRI. **Se deduce** del país y el número; no llega del formulario. */
  id_type: string;
  ruc: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  /** El país que eligió el cliente. Se guarda porque es lo que ÉL contestó. */
  pais?: string | null;
};

/**
 * Los importes de un cobro por cada método de pago.
 *
 * La transferencia va con `TARIFA_TRANSFERENCIA` (cero): en una transferencia no hay
 * pasarela y no cobra nadie, así que no hay comisión que trasladarle al cliente. Cobrarle un
 * recargo ahí sería inventarse un cargo.
 */
function importesPorMetodo(neto: number, proveedor: string) {
  const tarjeta = calcularRecargo(neto, tarifaDe(proveedor));
  const transferencia = calcularRecargo(neto, TARIFA_TRANSFERENCIA);
  return {
    card: { recargo: tarjeta.recargo, total: tarjeta.total },
    transfer: { recargo: transferencia.recargo, total: transferencia.total },
  };
}

/** Los orígenes que se pueden cobrar en línea hoy. */
export type OrigenCobro = 'project' | 'ticket' | 'subscription' | 'product';

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
  /** El recargo del método por DEFECTO (tarjeta). Se conserva para el código que ya lo usaba. */
  recargo: number;
  total: number;
  /**
   * Lo que cuesta pagar esto **por cada método**.
   *
   * ⚠️ El recargo no es del cobro, es del MÉTODO: la tarjeta lleva la comisión de la
   * pasarela y la transferencia no lleva ninguna, porque ahí no cobra nadie. Tenerlos los
   * dos calculados permite enseñárselos juntos al cliente antes de que elija — y así el
   * método más barato para los dos se elige solo.
   */
  importes: Record<MetodoPago, { recargo: number; total: number }>;
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
  // ⚠️ Un proyecto cancelado no se cobra. `getBillableProjects` ya los excluía del módulo de
  // facturas, pero esta puerta —la del cliente y la del enlace— no lo miraba: se podía pagar
  // la etapa de algo que ya no se va a hacer, y después habría que devolver el dinero.
  if (billing.status === 'cancelled') {
    throw new Error('Este proyecto está cancelado. Escríbenos antes de pagar.');
  }
  if (billing.mode !== 'etapas') {
    throw new Error('Este proyecto no tiene plan de etapas. El cobro en línea solo cubre proyectos con plan.');
  }
  const etapa = billing.etapas.find(e => e.id === Number(stageId));
  if (!etapa) throw new Error('La etapa no pertenece a este proyecto.');
  if (etapa.invoiceId) {
    throw new Error(`La etapa «${etapa.name}» ya está facturada (${etapa.invoiceNumber}).`);
  }
  // ⚠️ NO BASTA CON MIRAR SI LA ETAPA TIENE FACTURA. Un cobro puede estar `paid` sin
  // comprobante emitido —el SRI se cayó, o corría en modo ensayo—, y en ese hueco se podía
  // volver a cobrar lo ya cobrado. El dinero manda sobre la factura: si hay un cobro pagado,
  // la etapa está pagada.
  const enCurso = await cobroPagadoDeEtapa(etapa.id);
  if (enCurso?.status === 'awaiting') {
    throw new Error(`La etapa «${etapa.name}» ya tiene un pago por transferencia esperando confirmación. No hace falta pagar otra vez.`);
  }
  if (enCurso?.status === 'paid') {
    throw new Error(`La etapa «${etapa.name}» ya está pagada.`);
  }
  if (!(etapa.amount > 0)) throw new Error(`La etapa «${etapa.name}» no tiene importe.`);

  const { neto, recargo, total } = calcularRecargo(etapa.amount, tarifaDe(proveedor));
  return {
    importes: importesPorMetodo(neto, proveedor),
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
 * Qué cuesta pagar un proyecto **SIN plan de etapas**: entero y de una vez.
 *
 * ── POR QUÉ EXISTE (2026-08-28) ───────────────────────────────────────────────────────
 * El cobro en línea solo cubría proyectos con plan de etapas, y la mayoría de los
 * pequeños no lo tienen: el de Peter Tours son 300 $ y tres requerimientos. Su cliente
 * llegaba a la pantalla de pago y leía «Este proyecto no tiene plan de etapas», que desde
 * su lado es lo mismo que «no puedo pagarte».
 *
 * Decisión de Fernando: sin plan, **un solo pago**, y que la factura lleve el detalle de
 * los REQUERIMIENTOS con su precio. Es lo correcto además de lo cómodo — el cliente ve
 * facturado exactamente lo que aprobó en el proyecto, línea por línea.
 *
 * ⚠️ El importe NO es el presupuesto: es lo que queda **por facturar**, que `buildBilling`
 * ya calcula sumando los requerimientos sin factura viva. Cobrar el total volvería a
 * cobrar lo que ya se hubiera facturado a mano.
 *
 * Se exige que el proyecto esté **en revisión o completado**, igual que un ticket tiene
 * que estar completado: cobrarle a alguien por un trabajo que aún se está haciendo es lo
 * que la facturación por etapas evita en los proyectos que sí tienen plan.
 */
export async function cotizarProyectoSinEtapas(
  projectId: string | number,
  proveedor: string,
): Promise<EtapaCobrable> {
  const billing = await getProjectBilling(projectId);
  if (!billing) throw new Error('El proyecto no existe.');
  if (billing.status === 'cancelled') {
    throw new Error('Este proyecto está cancelado. Escríbenos antes de pagar.');
  }
  if (billing.status !== 'review' && billing.status !== 'completed') {
    throw new Error('Este proyecto todavía no está listo para cobrarse: falta que se entregue a revisión.');
  }
  if (!(billing.billable > 0)) {
    throw new Error(billing.invoiced > 0
      ? 'Este proyecto ya está facturado por completo.'
      : 'Este proyecto no tiene importe por cobrar.');
  }

  // El mismo candado que en ticket: `awaiting` ocupa el sitio igual que `paid`, para que
  // quien ya subió su comprobante no acabe pagando dos veces mientras alguien lo revisa.
  const yaPagado = await cobroPagadoDeOrigen('project', String(billing.projectId));
  if (yaPagado) {
    throw new Error(yaPagado.status === 'awaiting'
      ? 'Este proyecto ya tiene un pago por transferencia esperando confirmación. No hace falta pagar otra vez.'
      : 'Este proyecto ya fue pagado en línea.');
  }

  const { neto, recargo, total } = calcularRecargo(billing.billable, tarifaDe(proveedor));
  return {
    importes: importesPorMetodo(neto, proveedor),
    sourceType: 'project',
    sourceId: String(billing.projectId),
    title: billing.title,
    // Sin etapa: es lo que distingue este cobro del de un plan, y lo que el emisor mira
    // para saber que las líneas salen de los requerimientos.
    stageId: null,
    conceptName: billing.title,
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
  if (yaPagado) {
    throw new Error(yaPagado.status === 'awaiting'
      ? 'Este ticket ya tiene un pago por transferencia esperando confirmación. No hace falta pagar otra vez.'
      : 'Este ticket ya fue pagado en línea.');
  }

  const { neto, recargo, total } = calcularRecargo(pagos.pending, tarifaDe(proveedor));
  return {
    importes: importesPorMetodo(neto, proveedor),
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
  if (yaPagado) {
    throw new Error(yaPagado.status === 'awaiting'
      ? `El mes de ${mes.label} ya tiene un pago por transferencia esperando confirmación. No hace falta pagar otra vez.`
      : `El mes de ${mes.label} ya fue pagado en línea.`);
  }

  const neto = Number(sub.monthly_cost) || 0;
  if (!(neto > 0)) throw new Error('Esta suscripción no tiene importe mensual.');

  const { recargo, total } = calcularRecargo(neto, tarifaDe(proveedor));
  return {
    importes: importesPorMetodo(neto, proveedor),
    sourceType: 'subscription',
    sourceId,
    title: sub.title,
    stageId: null,
    conceptName: `${sub.title} — ${mes.label}`,
    neto, recargo, total, proveedor,
  };
}

/**
 * El identificador del alta de un producto: `p<idProducto>-u<idUsuario>`.
 *
 * ⚠️ LLEVA AL COMPRADOR DENTRO, y esa es la diferencia con los demás orígenes. Una etapa o
 * un ticket son de un solo cliente, así que basta su id; un producto lo compran muchos, y
 * si el identificador fuera solo el del producto el candado
 * `idx_payment_intents_origen_pagado` dejaría que **el primer comprador bloqueara a todos
 * los demás**. Con el par (producto, comprador), cada uno tiene el suyo y **nadie paga dos
 * veces el alta del mismo producto**.
 */
export function idAltaProducto(itemId: string | number, userId: string | number): string {
  return `p${itemId}-u${userId}`;
}

/** Descompone `p<idProducto>-u<idUsuario>`. */
export function partesAltaProducto(sourceId: string): { itemId: string; userId: string } {
  const m = /^p(\d+)-u(.+)$/.exec(sourceId);
  if (!m) throw new Error('Identificador de producto inválido.');
  return { itemId: m[1], userId: m[2] };
}

/**
 * Qué cuesta darse de alta en un PRODUCTO.
 *
 * Los productos del grupo se venden por mensualidad (5 $/mes hoy), así que «comprar» es
 * **contratar la suscripción y pagar su primer mes** — no una compra única. Por eso lo que
 * se cobra aquí es exactamente una mensualidad, y al confirmarse el pago nace la
 * suscripción con ese mes ya pagado (ver `emitirFacturaDelCobro`).
 *
 * ⚠️ La suscripción NO se crea al empezar el cobro, solo al confirmarlo. Crearla antes
 * llenaría la lista de suscripciones fantasma de gente que abandonó el pago a medias.
 */
export async function cotizarProducto(
  itemId: string | number,
  userId: string | number,
  proveedor: string,
): Promise<Cobrable> {
  const { rows: [item] } = await pool.query(
    `SELECT id, title, cost, es_suscripcion, item_type
       FROM gcc_world.member_portfolio_items WHERE id = $1`,
    [itemId],
  );
  if (!item) throw new Error('El producto no existe.');
  if (item.item_type !== 'product') throw new Error('Esto no es un producto del catálogo.');
  if (!item.es_suscripcion) {
    // Un producto de pago único todavía no existe en el catálogo; cuando exista habrá que
    // decidir qué se le entrega al cobrar, y eso no se adivina.
    throw new Error('Este producto no se cobra por mensualidad. Escríbenos para contratarlo.');
  }

  const neto = Number(item.cost) || 0;
  if (!(neto > 0)) throw new Error('Este producto no tiene precio definido.');

  const sourceId = idAltaProducto(item.id, userId);
  const yaPagado = await cobroPagadoDeOrigen('product', sourceId);
  if (yaPagado) {
    throw new Error(yaPagado.status === 'awaiting'
      ? 'Ya tienes un pago por transferencia esperando confirmación para este producto.'
      : 'Ya contrataste este producto. Tus meses siguientes se pagan desde Suscripciones.');
  }

  const { recargo, total } = calcularRecargo(neto, tarifaDe(proveedor));
  return {
    importes: importesPorMetodo(neto, proveedor),
    sourceType: 'product',
    sourceId,
    title: item.title,
    stageId: null,
    conceptName: `${item.title} — primer mes`,
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
  if (destino.sourceType === 'product') {
    const { itemId, userId } = partesAltaProducto(destino.sourceId);
    return cotizarProducto(itemId, userId, proveedor);
  }
  if (destino.sourceType === 'ticket') return cotizarTicket(destino.sourceId, proveedor);
  // Sin etapa ya no es un error: es un proyecto sin plan, y se cobra entero de una vez.
  if (destino.stageId == null) return cotizarProyectoSinEtapas(destino.sourceId, proveedor);
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

/**
 * Un cobro que ocupa el sitio: pagado **o esperando confirmación**.
 *
 * ⚠️ `awaiting` cuenta igual que `paid`. Un cliente que ya subió su comprobante no puede
 * volver a pagar lo mismo mientras alguien lo revisa — si no, acabaría pagando dos veces y
 * habría que devolverle dinero. Los índices únicos de la base lo impiden igualmente, pero
 * chocar contra ellos le devuelve al cliente un error de restricción; preguntarlo antes
 * permite decirle **por qué**.
 */
export async function cobroPagadoDeOrigen(
  sourceType: string, sourceId: string,
): Promise<{ id: number; invoice_id: number | null; status: string } | null> {
  const { rows } = await pool.query(
    `SELECT id, invoice_id, status FROM gcc_world.payment_intents
      WHERE source_type = $1 AND source_id = $2 AND stage_id IS NULL
        AND status IN ('paid','awaiting') LIMIT 1`,
    [sourceType, sourceId],
  );
  return rows[0] || null;
}

export async function cobroPagadoDeEtapa(stageId: number): Promise<{ id: number; invoice_id: number | null; status: string } | null> {
  const { rows } = await pool.query(
    `SELECT id, invoice_id, status FROM gcc_world.payment_intents
      WHERE stage_id = $1 AND status IN ('paid','awaiting') LIMIT 1`,
    [stageId],
  );
  return rows[0] || null;
}

export async function crearIntento(opts: {
  etapa: Cobrable;
  canal: CanalCobro;
  facturacion: DatosFacturacion;
  payerEmail: string;
  createdBy?: string | number | null;
  /** Decide el recargo: con transferencia es cero. Por defecto, tarjeta. */
  metodo?: MetodoPago;
}): Promise<{ id: number; total: number; neto: number; recargo: number }> {
  const { canal, facturacion, payerEmail, createdBy } = opts;
  const metodo: MetodoPago = opts.metodo === 'transfer' ? 'transfer' : 'card';
  // ⚠️ El importe se toma del MÉTODO elegido, no del campo por defecto del cobrable: si no,
  // una transferencia guardaría el recargo de la tarjeta y le cobraríamos al cliente una
  // comisión que nadie va a cobrar.
  const delMetodo = opts.etapa.importes[metodo];
  const etapa: Cobrable = { ...opts.etapa, recargo: delMetodo.recargo, total: delMetodo.total };

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

  if (intento) {
    // ⚠️ EL ENLACE DE PAGO SE QUEMA AL COBRAR, y no solo el que se usó.
    //
    // `paid_at` existía desde la migración 053 y **nadie lo escribía**: un enlace ya pagado
    // seguía abriéndose y ofreciendo pagar otra vez. Se marcan **todos** los enlaces vivos
    // del mismo destino, no solo el del intento, porque el responsable pudo generar dos para
    // la misma etapa y el segundo seguiría siendo una puerta abierta.
    await pool.query(
      `UPDATE gcc_world.payment_links
          SET paid_at = NOW()
        WHERE paid_at IS NULL
          AND (intent_id = $1
               OR (source_type = $2 AND source_id = $3
                   AND stage_id IS NOT DISTINCT FROM $4))`,
      [intentId, intento.source_type, intento.source_id, intento.stage_id],
    ).catch((e: any) => console.error('[pagos] no se pudo quemar el enlace del cobro', intentId, e.message));

    await completarProyectoPagado(intento);
  }

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
 * Un proyecto sin plan de etapas que se paga entero queda **completado**.
 *
 * ── POR QUÉ EL PAGO CIERRA EL PROYECTO (Fernando, 2026-08-28) ─────────────────────────
 * Un proyecto «en revisión» está esperando que el cliente diga que sí. Pagarlo **es** decir
 * que sí: nadie paga una entrega que no acepta. Pedirle además a un administrador que
 * pulse «Completar» sería un trámite que no decide nada y que deja el proyecto en revisión
 * durante días después de haber cobrado.
 *
 * ⚠️ SOLO SIN PLAN DE ETAPAS (`stage_id IS NULL`). Con plan, cada etapa es un pago parcial
 * y cobrar la primera no significa que el proyecto esté entregado — cerrarlo ahí sería
 * darlo por terminado a un tercio.
 *
 * Va aquí y no tras emitir la factura, a propósito: **el dinero es lo que decide**. Si el
 * SRI falla o corre el modo ensayo, el cliente ha pagado igual y su proyecto tiene que
 * reflejarlo; la factura se reintenta después, el estado no debería depender de ella.
 *
 * Y sirve para los dos métodos sin escribir nada más: con tarjeta esto corre al confirmar
 * la pasarela, y con transferencia corre cuando el responsable confirma que el dinero está
 * en el banco — que es cuando toca.
 */
async function completarProyectoPagado(intento: any) {
  if (intento.source_type !== 'project' || intento.stage_id != null) return;
  try {
    await pool.query(
      `UPDATE gcc_world.projects
          SET status = 'completed', updated_at = NOW()
        WHERE id = ($1)::bigint AND status = 'review'`,
      [String(intento.source_id)],
    );
  } catch (e: any) {
    // No puede tumbar el cobro: el dinero ya entró y la factura va después.
    console.error('[pagos] cobro', intento.id, 'no pudo completar el proyecto:', e.message);
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
  const esProducto = sourceType === 'product';
  // ⚠️ UN PRODUCTO SE FACTURA COMO LO QUE ES: el primer mes de una suscripción. Por eso
  // entra por el mismo camino que ella —mismo emisor, mismo marcado del mes— con la única
  // diferencia de que la suscripción **todavía no existe** y hay que crearla antes.
  let esSuscripcion = sourceType === 'subscription';

  let titulo = esTicket ? 'Ticket' : (esSuscripcion || esProducto) ? 'Suscripción' : 'Proyecto';
  let nombreEtapa = titulo;
  let subId = '';
  let periodo = '';
  let ivaSuscripcion = 0;
  /** Los requerimientos que van como líneas, cuando el proyecto no tiene plan de etapas. */
  let requerimientos: { id: number; title: string; amount: number }[] = [];

  // ── EL ALTA DE UN PRODUCTO CREA SU SUSCRIPCIÓN ────────────────────────────
  //
  // Aquí, y no antes: hasta que el dinero no entra no se materializa nada, igual que con la
  // factura. Crear la suscripción al abrir la pantalla de pago llenaría el módulo de
  // suscripciones fantasma de gente que abandonó a medias.
  //
  // A partir de esta línea el cobro **es** el de una suscripción, así que sigue el mismo
  // camino que ella: mismo emisor, mismo marcado del mes, misma reversión al anular.
  if (esProducto) {
    const { itemId, userId: compradorId } = partesAltaProducto(sourceId);
    const { rows: [item] } = await pool.query(
      `SELECT id, title, cost FROM gcc_world.member_portfolio_items WHERE id = $1`, [itemId]);
    const hoy = new Date();
    periodo = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`;

    const { rows: [nueva] } = await pool.query(
      `INSERT INTO gcc_world.subscriptions
         (title, monthly_cost, iva_rate, currency, start_date, status,
          client_id_type, client_ruc, client_name_sri, client_email_sri,
          client_phone_sri, client_address_sri, created_by, notes)
       VALUES ($1, $2, 0, 'USD', $3, 'active', $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        item?.title || 'Producto', Number(item?.cost) || neto, hoy.toISOString().slice(0, 10),
        facturacion.id_type, facturacion.ruc, facturacion.name, facturacion.email,
        facturacion.phone || null, facturacion.address || null, facturacion.email,
        `Alta contratada desde el marketplace el ${hoy.toISOString().slice(0, 10)} (cobro #${intento.id}).`,
      ],
    );
    subId = String(nueva.id);
    titulo = item?.title || 'Producto';
    nombreEtapa = `${titulo} — primer mes`;

    /**
     * ⇒ SI LO COMPRADO ES UNA AUTOMATIZACIÓN, AQUÍ SE LE MONTA SU FLUJO.
     *
     * Una automatización vive dentro de esta plataforma: lo que se compra es el derecho a
     * usar un flujo. Si la compra solo dejara la suscripción, el cliente vería el cargo en
     * su tarjeta, entraría a Automatizaciones y no habría nada — y para él la compra
     * habría fallado, por bien que funcionara el cobro.
     *
     * Va en el mismo sitio y por el mismo motivo que la creación de la suscripción: hasta
     * que el dinero no entra no se materializa nada. Y no lanza nunca — ver
     * `aprovisionarAutomatizacion`.
     */
    await aprovisionarAutomatizacion({ itemId, subscriptionId: subId, compradorUserId: compradorId });

    // Desde aquí se comporta como una suscripción a todos los efectos.
    esSuscripcion = true;
  } else if (esSuscripcion) {
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
    titulo = billing?.title || 'Proyecto';
    if (stageId != null) {
      const etapa = billing?.etapas.find(e => e.id === stageId);
      nombreEtapa = etapa?.name || `Etapa ${stageId}`;
    } else {
      /**
       * ⇒ PROYECTO SIN PLAN DE ETAPAS: la factura lleva **un renglón por requerimiento**,
       * con su precio (decisión de Fernando, 2026-08-28).
       *
       * Es lo que el cliente aprobó y lo que ve en su proyecto, así que reconoce la
       * factura sin tener que fiarse: si el proyecto dice 105 + 120 + 75, la factura dice
       * lo mismo. Una sola línea de «Proyecto — 300 $» obligaría a creérselo.
       *
       * Se toman los requerimientos **sin factura viva**, que son exactamente los que
       * suman el importe cobrado (`billing.billable`, ver `cotizarProyectoSinEtapas`).
       */
      requerimientos = (billing?.stages ?? []).filter(r => !r.invoiceId && r.amount > 0);
      nombreEtapa = titulo;
    }
  }

  // ⚠️ EL IMPORTE DE UNA SUSCRIPCIÓN LLEVA SU IVA DENTRO. `monthly_cost` es el precio final
  // (así se guarda desde 2026-06-11), así que la línea va con la base desglosada hacia atrás
  // — exactamente como lo hace «Marcar pagado». Si se pasara el total como base, el
  // comprobante saldría por más de lo cobrado. Con `iva_rate = 0`, que es lo que usa GCC
  // hoy, base y total coinciden.
  const baseSuscripcion = ivaSuscripcion > 0 ? neto / (1 + ivaSuscripcion / 100) : neto;

  const items = requerimientos.length > 0
    // Proyecto sin plan: un renglón por requerimiento, tal como el cliente los aprobó.
    ? requerimientos.map(r => ({
        description: `${titulo} — ${r.title}`,
        quantity: 1,
        unitPrice: r.amount,
        ivaRate: 0,
        discount: 0,
      }))
    : [
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
        // ⚠️ Sin esto la factura no quedaría atada a los requerimientos, y `getProjectStages`
        // los seguiría dando por facturables: el proyecto se podría volver a cobrar entero.
        // Es el equivalente, sin plan de etapas, de marcar la etapa como facturada.
        requirementIds: requerimientos.map(r => String(r.id)),
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

// ─── TRANSFERENCIA BANCARIA ───────────────────────────────────────────────────
//
// El camino sin pasarela. Aquí no hay un tercero que diga «este dinero entró»: lo único que
// llega es una imagen que sube el propio cliente, y **una imagen no prueba nada** — puede
// ser de otra transferencia, de otro importe o de otro día. Por eso el cobro no pasa a
// `paid` sino a `awaiting`, y quien lo mueve es una persona que ha mirado su banco.

/** Formatos que se aceptan como comprobante. Un comprobante es una foto o un PDF. */
const TIPOS_COMPROBANTE = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
/** 8 MB: una foto de móvil cabe de sobra y un PDF de banco también. */
const MAX_COMPROBANTE = 8 * 1024 * 1024;

export async function registrarComprobante(opts: {
  intentId: number;
  archivo: { nombre: string; tipo: string; bytes: Buffer };
  referencia?: string | null;
  banco?: string | null;
}): Promise<void> {
  const { intentId, archivo } = opts;

  if (!TIPOS_COMPROBANTE.includes(archivo.tipo)) {
    throw new Error('El comprobante debe ser una imagen (JPG, PNG, WEBP, HEIC) o un PDF.');
  }
  if (archivo.bytes.length > MAX_COMPROBANTE) {
    throw new Error('El comprobante no puede pasar de 8 MB.');
  }
  if (archivo.bytes.length < 100) {
    throw new Error('El archivo está vacío.');
  }

  // ⚠️ Solo se acepta el comprobante de un cobro que sigue vivo. Sin este `WHERE`, subir un
  // comprobante sobre algo ya pagado lo devolvería a «en espera» y dejaría el cobro
  // esperando una confirmación que ya no toca.
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.payment_intents
        SET proof_data = $2, proof_type = $3, proof_name = $4, proof_at = NOW(),
            proof_reference = $5, proof_bank = $6,
            provider_method = 'transfer', status = 'awaiting',
            failure_reason = NULL, updated_at = NOW()
      WHERE id = $1 AND status IN ('pending','processing','failed')`,
    [
      intentId, archivo.bytes, archivo.tipo, archivo.nombre.slice(0, 200),
      (opts.referencia || '').trim().slice(0, 120) || null,
      (opts.banco || '').trim().slice(0, 40) || null,
    ],
  );
  if (!rowCount) {
    throw new Error('Este cobro ya no admite un comprobante: puede que ya esté pagado o en revisión.');
  }
}

/**
 * Los cobros por transferencia que esperan que alguien los confirme.
 *
 * ⚠️ EL `id` QUE LLEGA ES EL DEL ORIGEN, NO EL DEL COBRO, y en dos de los cuatro no
 * coinciden: el `source_id` de una suscripción es `<id>-<AAAA-MM>` y el de un producto es
 * `p<id>-u<comprador>`. Buscar por igualdad devolvía **cero** en esos dos, así que el bloque
 * de confirmación no aparecía nunca y el pago del cliente se quedaba esperando para siempre.
 * Por eso ahí se busca por prefijo.
 */
export async function cobrosEnEspera(sourceType: string, id: string) {
  const porPrefijo = sourceType === 'subscription' || sourceType === 'product';
  const patron = sourceType === 'subscription' ? `${id}-%`
    : sourceType === 'product' ? `p${id}-u%`
    : id;
  const { rows } = await pool.query(
    `SELECT id, source_id, net_amount, fee_amount, charge_amount, payer_email, proof_at,
            proof_name, proof_type, proof_reference, proof_bank, billing_snapshot, created_at
       FROM gcc_world.payment_intents
      WHERE source_type = $1 AND status = 'awaiting'
        AND (${porPrefijo ? 'source_id LIKE $2' : 'source_id = $2'})
      ORDER BY proof_at DESC NULLS LAST, id DESC`,
    [sourceType, patron],
  );
  return rows;
}

/** Todos los cobros a la espera, para que nadie se quede olvidado en un detalle que nadie abre. */
export async function todosLosCobrosEnEspera() {
  const { rows } = await pool.query(
    `SELECT id, source_type, source_id, stage_id, charge_amount, payer_email,
            proof_at, proof_bank, proof_reference, billing_snapshot
       FROM gcc_world.payment_intents
      WHERE status = 'awaiting'
      ORDER BY proof_at ASC NULLS LAST`,
  );
  return rows;
}

/**
 * CONFIRMA una transferencia: alguien miró su banco y dio el dinero por recibido.
 *
 * A partir de aquí es un cobro como cualquier otro — `confirmarPago` emite la factura, marca
 * la etapa o el mes y registra el ingreso—, así que el comprobante sale idéntico venga de
 * PayPhone o del banco.
 *
 * Se deja escrito **quién** confirmó: un cobro sin pasarela detrás siempre tiene que tener
 * un responsable con nombre.
 */
export async function confirmarTransferencia(
  intentId: number,
  quien: string,
): Promise<ResultadoConfirmacion> {
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.payment_intents
        SET confirmed_by = $2, confirmed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'awaiting'`,
    [intentId, quien.slice(0, 255)],
  );
  if (!rowCount) throw new Error('Este cobro no está esperando confirmación.');

  return confirmarPago(intentId, {
    referencia: `transferencia:${intentId}`,
    metodo: 'transfer',
    estadoProveedor: `Transferencia confirmada por ${quien}`,
  });
}

/** Rechaza un comprobante que no cuadra. El cobro vuelve a estar disponible para reintentar. */
export async function rechazarTransferencia(intentId: number, quien: string, motivo: string): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.payment_intents
        SET status = 'failed',
            failure_reason = $3,
            confirmed_by = $2, confirmed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'awaiting'`,
    [intentId, quien.slice(0, 255), `Comprobante rechazado por ${quien}: ${motivo}`.slice(0, 500)],
  );
  if (!rowCount) throw new Error('Este cobro no está esperando confirmación.');
}
