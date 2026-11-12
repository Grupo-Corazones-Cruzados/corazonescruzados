/**
 * ⭐ LAS FACTURAS DE UN COBRO — fase 4, paso 4 del modelo económico (Fernando, 2026-11-09; MEMORIA.md › «EL
 * MODELO ECONÓMICO DE LA PLATAFORMA» › «Reparto»): «el pago llega SIEMPRE a Grupo Corazones Cruzados; luego se
 * generan facturas automáticas con las cuentas de facturación de los usuarios que facturan al cliente».
 *
 * Al confirmarse un pago (`confirmarPago` → `emitirFacturaDelCobro`), las líneas se agrupan por beneficiario con
 * EXACTAMENTE el mismo reparto que las ganancias (`partesDeTerceros` en `lib/ganancias.ts`):
 *   · lo de un miembro con cuenta de emisor `activo` (nunca `en_pruebas`: ver `emisorHabilitadoDe`) sale en
 *     SU factura al cliente, numerada en su serie y firmada con su firma;
 *   · todo lo demás —sin beneficiario, beneficiario sin emisor habilitado, el resto de GCC, el recargo— sigue en la
 *     factura de GCC, como hasta hoy.
 * Si todo es de GCC (hoy, que ningún miembro tiene emisor activo) `planificarFacturasDelCobro` devuelve `null` y el
 * cobro sigue el camino de siempre, intacto: una factura de GCC.
 *
 * La comisión de la pasarela NO va en ninguna factura (el cliente paga el precio final): se descuenta en el libro
 * de ganancias de quien la carga, como en el paso 1. La suma de las facturas es lo cobrado; si no cuadra, se
 * vuelve a la factura única de GCC y se deja escrito.
 *
 * DURABLE: el plan se guarda antes de emitir (`payment_intent_invoices`, una fila por emisor y cobro, idempotente).
 * Cada factura se crea y se envía por separado: si la de un miembro no se puede CREAR, sus líneas pasan a la de GCC
 * (`reasignada`); si el SRI no contesta, queda `pendiente` y la reintenta el cron frecuente
 * (`/api/pagos/cron/facturas`). Ni la factura de un miembro bloquea la de GCC ni ninguna bloquea el cobro.
 */
import { pool } from '@/lib/db';
import type { InvoiceItem } from '@/lib/integrations/sri/xml-builder';
import {
  createManualInvoice, createManualInvoiceFromTicket, createManualInvoiceFromSubscription, completarEmisionSri,
} from '@/lib/integrations/sri';
import { cargarEmisor, emisorHabilitadoDe, numeracionPorAmbiente, esGcc, type Emisor, type Ambiente } from '@/lib/integrations/sri/emisor';
import { importesDelCobro, esCobroDeEnsayo, partesDeTerceros, registrarCobro } from '@/lib/ganancias';
import { DUENO_FINANZAS_GCC, addInvoiceIncomeToFinance, addSubscriptionIncomeToFinance } from '@/lib/finance';
import { getTicketBilling } from '@/lib/payments';
import { leerSeleccion, prepararRepartoPagos, repartirPagoEnRegistros, type SeleccionCobro } from '@/lib/tickets/reparto-pagos';
import { completarOrigenCobrado } from '@/lib/pagos/completar-origen';
import { nombrarTrasPago } from '@/lib/pagos/nombre-estandar';
import { upsertBillingForClient } from '@/lib/billing-clients';
import { sendPaidInvoiceEmail } from '@/lib/integrations/email';
import { centavos } from './comision';
import type { DatosFacturacion } from './intentos';

// ── Tipos ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Una línea del cobro con lo que hace falta para saber de quién es. */
export type LineaDelCobro = InvoiceItem & {
  discount: number;
  /** El requerimiento que factura la línea (proyecto sin etapas). */
  requirementId?: number | null;
  /** La línea del servicio cobrado (no el recargo). */
  servicio: boolean;
};

/** Lo que el cobro sabe de sí mismo y que necesitan todas sus facturas (también el reintento, horas después). */
export type ContextoCobro = {
  intentId: number;
  /** Cómo se factura: un producto se factura como la suscripción que crea. */
  tipo: 'project' | 'ticket' | 'subscription';
  /** El origen del intento, tal cual (`product` incluido). */
  sourceType: string;
  sourceId: string;
  stageId: number | null;
  subId: string;
  periodo: string;
  titulo: string;
  nombreEtapa: string;
  descripcionIngreso: string;
  neto: number;
  paymentCode: string;
  facturacion: DatosFacturacion;
};

export type GrupoFactura = {
  emisor: Emisor;
  memberId: number | null;
  userId: string | null;
  items: LineaDelCobro[];
  requirementIds: number[];
  stageIds: number[];
  /** La factura que lleva el servicio (ticket, etapa, mes): de ella cuelgan las etapas del ticket y el mes. */
  principal: boolean;
  total: number;
};

export type PlanFacturas = { grupos: GrupoFactura[]; cobro: number };

type GrupoGuardado = {
  items: LineaDelCobro[];
  requirementIds: number[];
  stageIds: number[];
  principal: boolean;
  userId: string | null;
};

type Fila = {
  id: number;
  payment_intent_id: number;
  emisor_id: number;
  member_id: number | null;
  invoice_id: number | null;
  amount: number;
  ambiente: Ambiente;
  estado: string;
  intentos: number;
  contexto: ContextoCobro & { grupo: GrupoGuardado };
};

const MAX_INTENTOS = 10;
const LOG = '[facturas-del-cobro]';

/** El total de unas líneas tal como lo calcula la factura (`invoiceTotals` del emisor): neto de descuento + IVA. */
export function totalDeLineas(items: InvoiceItem[]): number {
  const neto = (i: InvoiceItem) => Math.round((i.quantity * i.unitPrice - (i.discount || 0)) * 100) / 100;
  const sub = items.reduce((s, i) => s + neto(i), 0);
  const iva = items.reduce((s, i) => s + Math.round(neto(i) * (i.ivaRate / 100) * 100) / 100, 0);
  return Math.round((sub + iva) * 100) / 100;
}

// ── ¿Está la migración 090? ──────────────────────────────────────────────────────────────────────────────────

let hayTabla: boolean | null = null;
/** Sin la migración 090 no hay facturas de miembros: todo sale en la de GCC, como antes. */
export async function hayFacturasPorMiembro(): Promise<boolean> {
  if (hayTabla) return true;
  const { rows: [r] } = await pool.query(`SELECT to_regclass('gcc_world.payment_intent_invoices') IS NOT NULL AS hay`);
  const hay = !!r?.hay && (await numeracionPorAmbiente());
  if (hay) hayTabla = true;
  return hay;
}

// ── 1. El plan ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * QUÉ FACTURA CADA UNO. `null` = todo es de GCC (o el cobro es de ensayo, o falta la migración, o algo no cuadra):
 * el cobro sigue el camino de siempre, una factura de GCC.
 */
export async function planificarFacturasDelCobro(
  ctx: ContextoCobro, intento: any, lineas: LineaDelCobro[],
): Promise<PlanFacturas | null> {
  if (esCobroDeEnsayo(intento)) return null;
  if (!(await hayFacturasPorMiembro())) return null;

  const imp = importesDelCobro(intento, 0);
  const requirementIds = lineas.filter((l) => l.requirementId != null).map((l) => Number(l.requirementId));
  const partes = await partesDeTerceros({
    sourceType: ctx.tipo,
    sourceId: ctx.tipo === 'subscription' ? `${ctx.subId}-${ctx.periodo}` : ctx.sourceId,
    stageId: ctx.stageId, requirementIds, base: imp.base, comisionACargo: imp.comisionACargo,
  }, pool);

  // Quién de ellos factura él mismo. La cuenta de Fernando es GCC: lo suyo va siempre en la de GCC.
  const emisores = new Map<number, Emisor>();
  for (const p of partes) {
    if (p.memberId == null || p.userId === DUENO_FINANZAS_GCC || emisores.has(p.memberId)) continue;
    const e = await emisorHabilitadoDe(p.userId);
    if (e && !esGcc(e)) emisores.set(p.memberId, e);
  }
  if (emisores.size === 0) return null;

  const fallo = (motivo: string): null => {
    console.error(`${LOG} cobro ${ctx.intentId}: ${motivo}. Se emite una sola factura de GCC.`);
    return null;
  };

  const restantes: LineaDelCobro[] = lineas.map((l) => ({ ...l }));
  const grupos = new Map<number, GrupoFactura>();
  const grupoDe = (memberId: number, userId: string): GrupoFactura => {
    let g = grupos.get(memberId);
    if (!g) {
      g = { emisor: emisores.get(memberId)!, memberId, userId, items: [], requirementIds: [], stageIds: [], principal: false, total: 0 };
      grupos.set(memberId, g);
    }
    return g;
  };

  for (const p of partes) {
    if (p.memberId == null || !emisores.has(p.memberId)) continue;
    const g = grupoDe(p.memberId, p.userId);
    if (p.role === 'assignment') {
      // Su parte del requerimiento sale de la línea de ese requerimiento; lo que queda sigue en la de GCC.
      const i = restantes.findIndex((l) => l.requirementId != null && Number(l.requirementId) === Number(p.requirementId));
      if (i < 0) return fallo(`el requerimiento ${p.requirementId} no está entre las líneas`);
      const l = restantes[i];
      if (l.quantity !== 1 || (l.discount || 0) !== 0) return fallo(`la línea del requerimiento ${p.requirementId} no es de una unidad sin descuento`);
      const resto = centavos(l.unitPrice - p.gross);
      if (resto < 0) return fallo(`la parte de la asignación ${p.assignmentId} (${p.gross}) pasa de su línea (${l.unitPrice})`);
      g.items.push({ ...l, unitPrice: p.gross });
      if (!g.requirementIds.includes(Number(p.requirementId))) g.requirementIds.push(Number(p.requirementId));
      if (resto === 0) restantes.splice(i, 1);
      else l.unitPrice = resto;
    } else {
      // Ticket, etapa o mes: el servicio entero es suyo.
      const servicio = restantes.filter((l) => l.servicio);
      if (servicio.length === 0) return fallo('no hay línea de servicio');
      if (Math.abs(totalDeLineas(servicio) - p.gross) > 0.005) {
        return fallo(`el servicio (${totalDeLineas(servicio)}) no es la parte del beneficiario (${p.gross})`);
      }
      g.items.push(...servicio);
      g.principal = true;
      if (ctx.tipo === 'project' && ctx.stageId != null) g.stageIds = [ctx.stageId];
      for (const l of servicio) restantes.splice(restantes.indexOf(l), 1);
    }
  }

  const deMiembros = Array.from(grupos.values()).filter((g) => g.items.length > 0);
  if (deMiembros.length === 0) return null;

  const lista: GrupoFactura[] = [];
  if (restantes.length > 0) {
    const gcc = await cargarEmisor('gcc');
    const reqGcc = Array.from(new Set(restantes.filter((l) => l.requirementId != null).map((l) => Number(l.requirementId))));
    lista.push({
      emisor: gcc, memberId: null, userId: null, items: restantes, requirementIds: reqGcc,
      stageIds: ctx.tipo === 'project' && ctx.stageId != null && restantes.some((l) => l.servicio) ? [ctx.stageId] : [],
      principal: restantes.some((l) => l.servicio),
      total: 0,
    });
  }
  lista.push(...deMiembros);
  // Sin servicio en la de GCC, la principal es la primera del miembro.
  if (!lista.some((g) => g.principal)) lista[0].principal = true;
  for (const g of lista) g.total = totalDeLineas(g.items);

  // ⚠️ LA SUMA DE LAS FACTURAS ES LO COBRADO, al centavo.
  const suma = centavos(lista.reduce((s, g) => s + g.total, 0));
  if (suma !== imp.cobro) return fallo(`las facturas suman ${suma} y se cobró ${imp.cobro}`);
  if (suma !== totalDeLineas(lineas)) return fallo(`las facturas suman ${suma} y las líneas ${totalDeLineas(lineas)}`);

  return { grupos: lista, cobro: imp.cobro };
}

// ── 2. Emitir el plan ───────────────────────────────────────────────────────────────────────────────────────

const COLUMNAS_FILA = `id, payment_intent_id, emisor_id, member_id, invoice_id, amount, ambiente, estado, intentos, contexto`;

function aFila(r: any): Fila {
  return {
    id: Number(r.id), payment_intent_id: Number(r.payment_intent_id), emisor_id: Number(r.emisor_id),
    member_id: r.member_id != null ? Number(r.member_id) : null, invoice_id: r.invoice_id != null ? Number(r.invoice_id) : null,
    amount: Number(r.amount), ambiente: String(r.ambiente).trim() === '1' ? '1' : '2', estado: r.estado,
    intentos: Number(r.intentos) || 0, contexto: typeof r.contexto === 'string' ? JSON.parse(r.contexto) : r.contexto,
  };
}

async function filasDelCobro(intentId: number): Promise<Fila[]> {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_FILA} FROM gcc_world.payment_intent_invoices
      WHERE payment_intent_id = $1 ORDER BY (member_id IS NULL), id`,
    [intentId],
  );
  return rows.map(aFila);
}

/**
 * EMITE LAS FACTURAS DEL PLAN: guarda el plan, crea cada factura (las de los miembros primero, para que si una no
 * se puede crear sus líneas quepan aún en la de GCC), reparte las ganancias, las envía al SRI una a una y cierra lo
 * que cuelga de cada una al autorizarse. Devuelve la principal del cobro (`payment_intents.invoice_id`).
 */
export async function emitirFacturasRepartidas(
  ctx: ContextoCobro, plan: PlanFacturas,
): Promise<{ invoiceId: number; autorizada: boolean }> {
  // El plan, entero o nada, con su propio cliente (gcc-pool-transaccion-un-cliente).
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    for (const g of plan.grupos) {
      const grupo: GrupoGuardado = {
        items: g.items, requirementIds: g.requirementIds, stageIds: g.stageIds, principal: g.principal, userId: g.userId,
      };
      await cli.query(
        `INSERT INTO gcc_world.payment_intent_invoices
           (payment_intent_id, emisor_id, member_id, amount, ambiente, estado, procesando_desde, contexto)
         VALUES ($1, $2, $3, $4, $5, 'pendiente', NOW(), $6)
         ON CONFLICT (payment_intent_id, emisor_id) DO NOTHING`,
        [ctx.intentId, g.emisor.id, g.memberId, g.total.toFixed(2), g.emisor.ambiente, JSON.stringify({ ...ctx, grupo })],
      );
    }
    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cli.release();
  }

  // ── Crear cada factura: las de los miembros y, después, la de GCC ─────────────────────────────────────
  // La de GCC se lee DESPUÉS: puede haber recibido (o nacido de) las líneas de un miembro cuya factura no se pudo
  // crear.
  for (const deGcc of [false, true]) {
    for (const fila of (await filasDelCobro(ctx.intentId)).filter((f) => (f.member_id == null) === deGcc)) {
      if (fila.invoice_id != null || fila.estado !== 'pendiente') continue;
      try {
        await crearFacturaDeFila(fila);
      } catch (e: any) {
        console.error(`${LOG} cobro ${ctx.intentId}: no se pudo crear la factura ${deGcc ? "de GCC" : `del miembro ${fila.member_id}`}:`, e.message);
        if (!deGcc) await reasignarAGcc(fila, e.message);
        else await anotarFallo(fila, e.message, false);
      }
    }
  }

  try {
    const { rows: [proj] } = await pool.query(
      ctx.tipo === 'subscription' ? `SELECT client_id FROM gcc_world.subscriptions WHERE id = ($1)::bigint`
        : ctx.tipo === 'ticket' ? `SELECT client_id FROM gcc_world.tickets WHERE id = ($1)::bigint`
        : `SELECT client_id FROM gcc_world.projects WHERE id = ($1)::bigint`,
      [ctx.tipo === 'subscription' ? ctx.subId : ctx.sourceId],
    );
    if (proj?.client_id) await upsertBillingForClient(proj.client_id, ctx.facturacion);
  } catch (e: any) {
    console.error('[pagos] no se pudo enlazar el cliente:', e.message);
  }

  await repartirSiEstanTodas(ctx.intentId);

  // ── Enviar cada una al SRI, la de GCC primero ─────────────────────────────────────────────────────────
  const filas = (await filasDelCobro(ctx.intentId)).sort((a, b) => Number(a.member_id != null) - Number(b.member_id != null));
  for (const fila of filas) {
    if (fila.invoice_id == null || fila.estado !== 'pendiente') continue;
    await enviarFila(fila);
  }
  await pool.query(
    `UPDATE gcc_world.payment_intent_invoices SET procesando_desde = NULL, updated_at = NOW() WHERE payment_intent_id = $1`,
    [ctx.intentId],
  );

  const { rows: [pi] } = await pool.query(`SELECT invoice_id FROM gcc_world.payment_intents WHERE id = $1`, [ctx.intentId]);
  if (pi?.invoice_id == null) throw new Error('No se pudo crear ninguna factura del cobro; se reintentará.');
  const principal = (await filasDelCobro(ctx.intentId)).find((f) => f.invoice_id === Number(pi.invoice_id));
  return { invoiceId: Number(pi.invoice_id), autorizada: principal?.estado === 'autorizada' };
}

/** El emisor con el que se crea la factura de la fila: GCC, o el del miembro si sigue habilitado. */
async function emisorDeFila(fila: Fila): Promise<Emisor | undefined> {
  if (fila.member_id == null) return undefined; // los `create*` cargan el de GCC, como siempre
  // Leído de la base, sin la caché de 5 minutos: una cuenta suspendida hace un momento ya no emite.
  const e = await cargarEmisor(fila.emisor_id, pool);
  if (e.estado !== 'activo' && e.estado !== 'en_pruebas') throw new Error(`La cuenta de emisor ${fila.emisor_id} ya no está habilitada (${e.estado})`);
  // El ambiente es el del plan: una factura planificada en pruebas no pasa a producción por el camino.
  return e.ambiente === fila.ambiente ? e : { ...e, ambiente: fila.ambiente };
}

/** Crea la factura de una fila y la enlaza (cobro, cliente, etapas del ticket). */
async function crearFacturaDeFila(fila: Fila): Promise<number> {
  const c = fila.contexto;
  const g = c.grupo;
  if (!g.items.length) throw new Error('La factura no tiene líneas');
  const emisor = await emisorDeFila(fila);
  const f = c.facturacion;
  const comunes = {
    clientIdType: f.id_type, clientName: f.name, clientRuc: f.ruc, clientEmail: f.email,
    clientPhone: f.phone || '', clientAddress: f.address || '', paymentCode: c.paymentCode,
    invoiceItems: g.items.map(({ description, quantity, unitPrice, ivaRate, discount }) => ({ description, quantity, unitPrice, ivaRate, discount: discount || 0 })),
    currency: 'USD', exchangeRate: 1, emisor, memberId: fila.member_id,
  };
  const { invoiceId } = c.tipo === 'subscription'
    ? await createManualInvoiceFromSubscription({ ...comunes, subscriptionId: c.subId, period: c.periodo, title: c.titulo })
    : c.tipo === 'ticket'
    ? await createManualInvoiceFromTicket({ ...comunes, ticketId: c.sourceId, ticketTitle: c.titulo })
    : await createManualInvoice({
        ...comunes, projectIds: [c.sourceId],
        stageIds: g.stageIds.map(String), requirementIds: g.requirementIds.map(String),
      });

  await pool.query(`UPDATE gcc_world.invoices SET payment_intent_id = $1, updated_at = NOW() WHERE id = $2`, [c.intentId, invoiceId]);
  await pool.query(
    `UPDATE gcc_world.payment_intent_invoices SET invoice_id = $2, ultimo_error = NULL, updated_at = NOW() WHERE id = $1`,
    [fila.id, invoiceId],
  );
  // `payment_intents.invoice_id` = la de GCC; si no hay de GCC, la primera que se crea.
  await pool.query(
    `UPDATE gcc_world.payment_intents SET invoice_id = $1, updated_at = NOW()
      WHERE id = $2 AND (invoice_id IS NULL OR $3::boolean)`,
    [invoiceId, c.intentId, fila.member_id == null],
  );
  try {
    const { rows: [o] } = await pool.query(
      c.tipo === 'subscription' ? `SELECT client_id FROM gcc_world.subscriptions WHERE id = ($1)::bigint`
        : c.tipo === 'ticket' ? `SELECT client_id FROM gcc_world.tickets WHERE id = ($1)::bigint`
        : `SELECT client_id FROM gcc_world.projects WHERE id = ($1)::bigint`,
      [c.tipo === 'subscription' ? c.subId : c.sourceId],
    );
    if (o?.client_id) await pool.query(`UPDATE gcc_world.invoices SET client_id = $1 WHERE id = $2`, [o.client_id, invoiceId]);
  } catch (e: any) {
    console.error('[pagos] no se pudo enlazar el cliente:', e.message);
  }
  if (c.tipo === 'ticket' && g.principal) await marcarTicketCobrado(c.intentId, c.sourceId, c.stageId, c.neto, invoiceId);
  return invoiceId;
}

/** La factura del miembro no se pudo crear: sus líneas pasan a la de GCC (que aún no se ha creado). */
async function reasignarAGcc(fila: Fila, motivo: string): Promise<void> {
  const gcc = await cargarEmisor('gcc');
  const ctxBase = { ...fila.contexto, grupo: { items: [], requirementIds: [], stageIds: [], principal: false, userId: null } };
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    await cli.query(
      `INSERT INTO gcc_world.payment_intent_invoices (payment_intent_id, emisor_id, member_id, amount, ambiente, estado, procesando_desde, contexto)
       VALUES ($1, $2, NULL, 0, '2', 'pendiente', NOW(), $3) ON CONFLICT (payment_intent_id, emisor_id) DO NOTHING`,
      [fila.payment_intent_id, gcc.id, JSON.stringify(ctxBase)],
    );
    const { rows: [r] } = await cli.query(
      `SELECT ${COLUMNAS_FILA} FROM gcc_world.payment_intent_invoices WHERE payment_intent_id = $1 AND emisor_id = $2 FOR UPDATE`,
      [fila.payment_intent_id, gcc.id],
    );
    const destino = aFila(r);
    if (destino.invoice_id != null) throw new Error('la factura de GCC ya está creada');
    const a = destino.contexto.grupo;
    const b = fila.contexto.grupo;
    const grupo: GrupoGuardado = {
      items: [...a.items, ...b.items],
      requirementIds: Array.from(new Set([...a.requirementIds, ...b.requirementIds])),
      stageIds: Array.from(new Set([...a.stageIds, ...b.stageIds])),
      principal: a.principal || b.principal,
      userId: null,
    };
    await cli.query(
      `UPDATE gcc_world.payment_intent_invoices SET contexto = $2, amount = $3, updated_at = NOW() WHERE id = $1`,
      [destino.id, JSON.stringify({ ...destino.contexto, grupo }), totalDeLineas(grupo.items).toFixed(2)],
    );
    await cli.query(
      `UPDATE gcc_world.payment_intent_invoices SET estado = 'reasignada', procesando_desde = NULL, ultimo_error = $2, updated_at = NOW() WHERE id = $1`,
      [fila.id, `Sus líneas pasaron a la factura de GCC: ${motivo}`.slice(0, 1000)],
    );
    await cli.query('COMMIT');
  } catch (e: any) {
    await cli.query('ROLLBACK').catch(() => {});
    // No cabe en la de GCC: queda pendiente y la reintenta el cron con su propio emisor.
    console.error(`${LOG} cobro ${fila.payment_intent_id}: no se pudo pasar a GCC lo del miembro ${fila.member_id}:`, e.message);
    await anotarFallo(fila, motivo, false);
  } finally {
    cli.release();
  }
}

/**
 * REPARTE LAS GANANCIAS cuando todas las facturas del cobro existen (es la misma llamada que con una sola, con la
 * factura de cada miembro). Idempotente: `repartirCobro` no repite un reparto hecho.
 */
async function repartirSiEstanTodas(intentId: number): Promise<void> {
  const filas = (await filasDelCobro(intentId)).filter((f) => f.estado !== 'reasignada');
  if (filas.length === 0 || filas.some((f) => f.invoice_id == null)) return;
  const { rows: [pi] } = await pool.query(`SELECT invoice_id, charge_amount FROM gcc_world.payment_intents WHERE id = $1`, [intentId]);
  if (pi?.invoice_id == null) return;
  const principal = Number(pi.invoice_id);
  const deMiembro: Record<number, number> = {};
  for (const f of filas) if (f.member_id != null && f.invoice_id != null) deMiembro[f.member_id] = f.invoice_id;
  const c = filas[0].contexto;
  try {
    await registrarCobro(principal, {
      descripcion: c.descripcionIngreso,
      facturas: { ids: filas.map((f) => f.invoice_id!), deMiembro },
    });
  } catch (e: any) {
    // Como con una sola factura: el ingreso entra entero a GCC y queda escrito para repartirlo a mano.
    console.error('[pagos] el reparto del cobro', intentId, 'falló; el ingreso va entero a GCC:', e.message);
    try {
      if (c.tipo === 'subscription') {
        await addSubscriptionIncomeToFinance(`${c.subId}-${c.periodo}`, c.descripcionIngreso, Number(pi.charge_amount) || 0, new Date());
      } else {
        await addInvoiceIncomeToFinance(String(principal), c.descripcionIngreso, Number(pi.charge_amount) || 0);
      }
      await pool.query(
        `UPDATE gcc_world.payment_intents SET failure_reason = $2 WHERE id = $1`,
        [intentId, `Cobrado y facturado, pero sin reparto de ganancias (todo a GCC): ${e.message}`],
      ).catch(() => {});
    } catch (e2: any) {
      console.error('[pagos] no se pudo registrar el ingreso:', e2.message);
    }
  }
}

/** Espera antes del siguiente intento: 10 min, 20, 40… hasta 6 h. */
function espera(intentos: number): number {
  return Math.min(10 * 2 ** Math.max(0, intentos - 1), 360);
}

async function anotarFallo(fila: Fila, error: string, definitivo: boolean): Promise<void> {
  const intentos = fila.intentos + 1;
  const estado = definitivo ? 'rechazada' : intentos >= MAX_INTENTOS ? 'fallida' : 'pendiente';
  await pool.query(
    `UPDATE gcc_world.payment_intent_invoices
        SET estado = $2, intentos = $3, ultimo_error = $4, procesando_desde = NULL,
            siguiente_intento = NOW() + ($5 || ' minutes')::interval, updated_at = NOW()
      WHERE id = $1`,
    [fila.id, estado, intentos, (error || 'Error desconocido').slice(0, 1000), String(espera(intentos))],
  );
  if (estado !== 'pendiente') console.error(`${LOG} la factura ${fila.invoice_id ?? '(sin crear)'} del cobro ${fila.payment_intent_id} quedó ${estado}: ${error}`);
}

/** Envía (o termina de enviar) una factura al SRI y, si se autoriza, cierra lo que cuelga de ella. */
async function enviarFila(fila: Fila): Promise<void> {
  if (fila.invoice_id == null) return;
  let r: { autorizada: boolean; definitivo: boolean; error?: string };
  try {
    r = await completarEmisionSri(fila.invoice_id);
  } catch (e: any) {
    r = { autorizada: false, definitivo: false, error: e.message };
  }
  if (!r.autorizada) return anotarFallo(fila, r.error || 'No autorizada', r.definitivo);
  await alAutorizarse(fila);
  await pool.query(
    `UPDATE gcc_world.payment_intent_invoices
        SET estado = 'autorizada', intentos = intentos + 1, ultimo_error = NULL, procesando_desde = NULL, updated_at = NOW()
      WHERE id = $1`,
    [fila.id],
  );
}

/** Lo que pasa cuando el SRI autoriza una factura del cobro: lo mismo que con la factura única de siempre. */
async function alAutorizarse(fila: Fila): Promise<void> {
  const c = fila.contexto;
  const invoiceId = fila.invoice_id!;
  await pool.query(
    `UPDATE gcc_world.invoices SET status = 'paid', updated_at = NOW() WHERE id = $1 AND status <> 'cancelled'`,
    [invoiceId],
  );
  if (c.tipo !== 'subscription') {
    try { await completarOrigenCobrado(c.sourceType, c.sourceId, invoiceId); }
    catch (e: any) { console.error('[pagos] cobro', c.intentId, 'no pudo completar el origen:', e.message); }
    await nombrarTrasPago(invoiceId);
  } else if (c.grupo.principal) {
    await marcarMesPagado(c.intentId, c.subId, c.periodo, c.facturacion.email, invoiceId, c.neto);
  }
  // Una factura de PRUEBAS no tiene validez tributaria: no se le manda al cliente como si la tuviera.
  if (fila.ambiente === '2') {
    await enviarCorreoDeFactura({
      intentId: c.intentId, invoiceId, email: c.facturacion.email, titulo: c.titulo, nombreEtapa: c.nombreEtapa,
      tipo: c.tipo, sourceId: c.sourceId,
    });
  }
}

// ── 3. El reintento (cron frecuente) ────────────────────────────────────────────────────────────────────────

/**
 * Reintenta las facturas de cobros que quedaron pendientes: sin crear, o sin respuesta del SRI. Cada una por su
 * lado; las que el SRI rechaza no se reintentan (`rechazada`) y las que agotan los intentos quedan `fallida`. Una
 * fila que alguien está procesando se respeta 15 minutos (gcc-after-muere-con-el-despliegue).
 */
export async function reintentarFacturasDeCobros(limite = 10): Promise<{ revisadas: number; autorizadas: number; pendientes: number; sinMigracion?: true }> {
  if (!(await hayFacturasPorMiembro())) return { revisadas: 0, autorizadas: 0, pendientes: 0, sinMigracion: true };
  const { rows } = await pool.query(
    `UPDATE gcc_world.payment_intent_invoices SET procesando_desde = NOW(), updated_at = NOW()
      WHERE id IN (
        SELECT id FROM gcc_world.payment_intent_invoices
         WHERE estado = 'pendiente'
           AND (siguiente_intento IS NULL OR siguiente_intento <= NOW())
           AND (procesando_desde IS NULL OR procesando_desde < NOW() - INTERVAL '15 minutes')
         ORDER BY payment_intent_id, (member_id IS NULL), id
         LIMIT $1
         FOR UPDATE SKIP LOCKED)
      RETURNING ${COLUMNAS_FILA}`,
    [limite],
  );
  let autorizadas = 0;
  for (const fila of rows.map(aFila)) {
    try {
      if (fila.invoice_id == null) {
        try {
          fila.invoice_id = await crearFacturaDeFila(fila);
        } catch (e: any) {
          await anotarFallo(fila, `No se pudo crear: ${e.message}`, false);
          continue;
        }
        await repartirSiEstanTodas(fila.payment_intent_id);
      }
      await enviarFila(fila);
      const { rows: [d] } = await pool.query(`SELECT estado FROM gcc_world.payment_intent_invoices WHERE id = $1`, [fila.id]);
      if (d?.estado === 'autorizada') autorizadas++;
    } catch (e: any) {
      await anotarFallo(fila, e.message, false).catch(() => {});
    }
  }
  // Las que se dieron por perdidas y alguien corrigió y reenvió a mano (Regenerar / Enviar al SRI): ya autorizadas,
  // les falta lo que cuelga de ellas (pagada, correo, mes, origen).
  const { rows: rescatadas } = await pool.query(
    `UPDATE gcc_world.payment_intent_invoices pii SET procesando_desde = NOW(), updated_at = NOW()
      WHERE pii.id IN (
        SELECT x.id FROM gcc_world.payment_intent_invoices x JOIN gcc_world.invoices i ON i.id = x.invoice_id
         WHERE x.estado IN ('rechazada', 'fallida') AND i.sri_status = 'authorized' AND i.status <> 'cancelled'
           AND (x.procesando_desde IS NULL OR x.procesando_desde < NOW() - INTERVAL '15 minutes')
         LIMIT $1 FOR UPDATE OF x SKIP LOCKED)
      RETURNING ${COLUMNAS_FILA}`,
    [limite],
  );
  for (const fila of rescatadas.map(aFila)) {
    try {
      await alAutorizarse(fila);
      await pool.query(
        `UPDATE gcc_world.payment_intent_invoices SET estado = 'autorizada', ultimo_error = NULL, procesando_desde = NULL, updated_at = NOW() WHERE id = $1`,
        [fila.id],
      );
      autorizadas++;
    } catch (e: any) {
      console.error(`${LOG} la factura ${fila.invoice_id} ya autorizada no pudo cerrarse:`, e.message);
      await pool.query(`UPDATE gcc_world.payment_intent_invoices SET procesando_desde = NULL WHERE id = $1`, [fila.id]).catch(() => {});
    }
  }
  const { rows: [p] } = await pool.query(`SELECT COUNT(*)::int AS n FROM gcc_world.payment_intent_invoices WHERE estado = 'pendiente'`);
  return { revisadas: rows.length + rescatadas.length, autorizadas, pendientes: p?.n ?? 0 };
}

/** La factura única de GCC de un cobro sin miembros, en la tabla de enlaces (sin reintento automático: `manual`). */
export async function anotarFacturaUnica(intentId: number, invoiceId: number, autorizada: boolean): Promise<void> {
  if (!(await hayFacturasPorMiembro())) return;
  await pool.query(
    `INSERT INTO gcc_world.payment_intent_invoices (payment_intent_id, emisor_id, member_id, invoice_id, amount, ambiente, estado)
     SELECT $1, COALESCE(i.emisor_id, (SELECT id FROM gcc_world.sri_emisores WHERE user_id IS NULL LIMIT 1)), NULL, i.id, COALESCE(i.total, 0), '2', $3
       FROM gcc_world.invoices i WHERE i.id = $2
     ON CONFLICT DO NOTHING`,
    [intentId, invoiceId, autorizada ? 'autorizada' : 'manual'],
  );
}

// ── Lo que cuelga de la factura del servicio (también lo usa el camino de la factura única) ──────────────────

/**
 * ⇒ LAS ETAPAS DEL TICKET QUEDAN FACTURADAS (2026-09-30), con su importe CONGELADO: la última no guarda importe
 * mientras está abierta (es el resto de lo consumido), así que al cobrarse se escribe lo que se cobró. Sin esto la
 * etapa seguiría «pendiente» y se podría cobrar otra vez.
 *  · Cobro de una etapa → esa etapa, por lo cobrado sin recargo.
 *  · Cobro de TODO lo pendiente → todas las etapas abiertas, cada una por su importe de ese momento (el de la
 *    última, calculado como el resto).
 * ⇒ Y LOS REGISTROS DE TRABAJO (Fernando, 2026-10-16): el cobro —de todo o de una etapa— consume todos los que
 * había sin facturar. Ver lib/tickets/facturacion.ts.
 */
export async function marcarTicketCobrado(intentId: number, sourceId: string, stageId: number | null, neto: number, invoiceId: number): Promise<void> {
  // Lo que eligió el cliente en el enlace, guardado con el cobro (null = el cobro de siempre).
  let seleccion: SeleccionCobro | null = null;
  try {
    await prepararRepartoPagos();
    const { rows: [pi] } = await pool.query(`SELECT seleccion FROM gcc_world.payment_intents WHERE id = $1`, [intentId]);
    seleccion = leerSeleccion(pi?.seleccion);
  } catch (e: any) { console.error('[pagos] cobro', intentId, 'no se pudo leer su selección:', e.message); }
  try {
    if (stageId != null) {
      await pool.query(
        `UPDATE gcc_world.project_stages SET invoice_id = $1, amount = $2, updated_at = NOW()
          WHERE id = $3 AND ticket_id = ($4)::bigint`,
        [invoiceId, neto.toFixed(2), stageId, sourceId],
      );
    } else if (seleccion?.modo === 'etapas') {
      // Varias etapas elegidas por el cliente (2026-11-12): solo esas, con su importe de ese momento.
      const tb = await getTicketBilling(sourceId);
      for (const e of (tb?.etapas || []).filter((x) => seleccion.etapas.includes(x.id) && !x.invoiceId)) {
        await pool.query(
          `UPDATE gcc_world.project_stages SET invoice_id = $1, amount = $2, updated_at = NOW()
            WHERE id = $3 AND ticket_id = ($4)::bigint`,
          [invoiceId, e.amount.toFixed(2), e.id, sourceId],
        );
      }
    } else if (seleccion?.modo === 'requerimientos') {
      // Por requerimientos no se toca el plan de etapas: lo pagado baja de lo pendiente del ticket.
    } else {
      const tb = await getTicketBilling(sourceId);
      for (const e of (tb?.etapas || []).filter((x) => !x.invoiceId && !x.cobro)) {
        await pool.query(
          `UPDATE gcc_world.project_stages SET invoice_id = $1, amount = $2, updated_at = NOW()
            WHERE id = $3 AND ticket_id = ($4)::bigint`,
          [invoiceId, e.amount.toFixed(2), e.id, sourceId],
        );
      }
    }
  } catch (e: any) {
    console.error('[pagos] cobro', intentId, 'no pudo marcar las etapas del ticket:', e.message);
  }
  // ⇒ LO PAGADO SE REPARTE SOBRE LOS REGISTROS (Fernando, 2026-11-12): enteros los que caben, de más antiguo a
  // más nuevo, y el resto como abono parcial. «Todo lo pendiente» los deja todos pagados, como antes.
  try { await repartirPagoEnRegistros({ intentId, ticketId: sourceId, neto, invoiceId, seleccion, stageId }); }
  catch (e: any) { console.error('[pagos] cobro', intentId, 'no pudo repartir el pago en los registros del ticket:', e.message); }
}

/**
 * ⚠️ UNA SUSCRIPCIÓN TIENE QUE QUEDAR MARCADA COMO PAGADA EN SU PROPIA TABLA.
 *
 * El resto del módulo —el aviso de vencimiento, el color del mes, el «desmarcar»— no mira `payment_intents`: mira
 * `subscription_payments`. Sin esta fila, el cliente pagaría y su mes seguiría saliendo en rojo como impago. Es la
 * misma escritura que hace «Marcar pagado», y por eso el `ON CONFLICT` respeta la clave (subscription_id, period).
 */
export async function marcarMesPagado(intentId: number, subId: string, periodo: string, email: string, invoiceId: number, neto: number): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO gcc_world.subscription_payments
         (subscription_id, period, paid, paid_at, paid_by, invoice_id, amount)
       VALUES ($1, $2, true, NOW(), $3, $4, $5)
       ON CONFLICT (subscription_id, period)
       DO UPDATE SET paid = true, paid_at = NOW(), paid_by = EXCLUDED.paid_by,
                     invoice_id = EXCLUDED.invoice_id, amount = EXCLUDED.amount`,
      [subId, `${periodo}-01`, email, invoiceId, neto],
    );
  } catch (e: any) {
    console.error(`[pagos] el mes ${periodo} se cobró pero no se marcó pagado:`, e.message);
    await pool.query(
      `UPDATE gcc_world.payment_intents SET failure_reason = $2 WHERE id = $1`,
      [intentId, `Cobrado y facturado, pero el mes no quedó marcado: ${e.message}`],
    ).catch(() => {});
  }
}

/**
 * ⚠️ Y SE LE MANDA LA FACTURA, porque la pantalla se lo prometió («La factura electrónica se emite con estos datos
 * y te llega al correo en cuanto el pago se confirme»). Va en su propio `try`: si el correo falla, el cobro y la
 * factura siguen siendo válidos; lo que no se puede es callarlo, así que queda en el registro. Con varias facturas,
 * un correo por factura, cada una con su emisor.
 */
export async function enviarCorreoDeFactura(o: {
  intentId: number; invoiceId: number; email: string; titulo: string; nombreEtapa: string;
  tipo: 'project' | 'ticket' | 'subscription'; sourceId: string; totalRespaldo?: number;
}): Promise<void> {
  try {
    const { rows: [inv] } = await pool.query(
      `SELECT invoice_number, authorization_number, total, pdf_data, ruc_emisor, razon_social_emisor
         FROM gcc_world.invoices WHERE id = $1`,
      [o.invoiceId],
    );
    const pdf = inv?.pdf_data
      ? (Buffer.isBuffer(inv.pdf_data) ? inv.pdf_data : Buffer.from(inv.pdf_data))
      : null;
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org';
    // La página del detalle necesita una llave: sin ella el ticket contestaba «Token requerido». Si se pagó con un
    // enlace de pago, ese enlace la abre (`enlaceVeDetalle`).
    const { rows: [enlacePagado] } = await pool.query(
      `SELECT token FROM gcc_world.payment_links WHERE intent_id = $1 LIMIT 1`, [o.intentId],
    ).catch(() => ({ rows: [] as any[] }));
    const llave = enlacePagado?.token ? `?link=${encodeURIComponent(enlacePagado.token)}` : '';
    await sendPaidInvoiceEmail({
      email: o.email,
      projectTitle: o.titulo,
      stageName: o.nombreEtapa,
      invoiceNumber: inv?.invoice_number || `#${o.invoiceId}`,
      authorization: inv?.authorization_number || null,
      total: Number(inv?.total) || Number(o.totalRespaldo) || 0,
      pdf,
      projectUrl: o.tipo === 'subscription' ? null
        : o.tipo === 'ticket' ? `${base}/ticket/${o.sourceId}${llave}`
        : `${base}/proyecto/${o.sourceId}${llave}`,
      emisor: inv?.ruc_emisor ? { ruc: inv.ruc_emisor, razonSocial: inv.razon_social_emisor || '' } : null,
    });
  } catch (e: any) {
    console.error(`[pagos] la factura ${o.invoiceId} se emitió pero el correo no salió:`, e.message);
    await pool.query(
      `UPDATE gcc_world.payment_intents
          SET failure_reason = 'Factura emitida, pero el correo al cliente no salió: ' || $2
        WHERE id = $1`,
      [o.intentId, e.message],
    ).catch(() => {});
  }
}
