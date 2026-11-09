import { pool } from '@/lib/db';
import { DUENO_FINANZAS_GCC, ensureFinanceTables, anotarIngreso, recalcMonth, type Consulta } from '@/lib/finance';
import { tarifaDe, netoRecibido, centavos } from '@/lib/pagos/comision';

/**
 * ⭐ GANANCIAS POR PERSONA — fase 4, paso 1 del modelo económico (Fernando, 2026-11-09; ver MEMORIA.md ›
 * «EL MODELO ECONÓMICO DE LA PLATAFORMA» › «Reparto»).
 *
 * La factura la sigue emitiendo GCC con el RUC de Fernando (la emisión no cambia), pero lo cobrado se reparte
 * entre quienes lo ganaron, y cada uno lo ve como ingreso en SU estado financiero, en su Inicio y en su tier:
 *   · TICKET: el responsable (`tickets.member_id`) se lleva lo cobrado menos la comisión de la pasarela.
 *   · PROYECTO sin etapas: cada asignación aceptada de cada requerimiento que cubre ESTA factura gana su propio
 *     precio (`COALESCE(member_cost, proposed_cost)`); el requerimiento compartido es la suma de cada uno. La
 *     comisión, en un proyecto GRUPAL, la carga cada parte en proporción a lo que pesa en el cobro; en uno
 *     INDIVIDUAL (un solo beneficiario), la carga entera ese beneficiario.
 *   · PROYECTO por etapas (solo con un único beneficiario, ver `motivoSinEtapas`): la etapa entera al
 *     beneficiario, menos la comisión.
 *   · SUSCRIPCIÓN / PRODUCTO: el dueño de la ficha del marketplace (`subscriptions.owner_member_id`) menos la
 *     comisión. Sin dueño (las anteriores y las que crea el administrador), de GCC.
 *   · Lo que no es de nadie (requerimientos sin asignación aceptada, redondeos, el recargo si se cobrara) es de GCC.
 *
 * ⚠️ LA GANANCIA CUENTA SOLO AL COBRARSE: esto corre al confirmarse el pago, nunca al completar el trabajo.
 *
 * El renglón de GCC en su estado financiero es el cobro MENOS lo neto de los demás: GCC recibe el dinero entero y
 * paga la comisión entera a la pasarela (que le llega como gasto del SRI), así que la comisión retenida a cada
 * persona se queda en su renglón para pagarla. Lo que Fernando gana como miembro (sus propias asignaciones) va en
 * ese mismo renglón: es la misma cuenta. Así la suma de todos los renglones es siempre el total cobrado.
 *
 * Todo es idempotente: el libro (`member_earnings`) es único por (factura, parte) y los renglones por su origen.
 */

export type Parte = {
  userId: string;
  memberId: number | null;
  role: 'assignment' | 'stage' | 'ticket' | 'subscription' | 'gcc';
  shareKey: string;
  requirementId?: number | null;
  assignmentId?: number | null;
  stageId?: number | null;
  gross: number;
  commission: number;
  amount: number;
};

export type Reparto = {
  invoiceId: number;
  sourceType: string;
  sourceId: string;
  /** Lo que pagó el cliente (el total de la factura). */
  cobro: number;
  /** La comisión real de la pasarela sobre el cobro. */
  comision: number;
  partes: Parte[];
  /** Lo que se anota en el estado financiero de GCC: cobro − lo neto de los demás. */
  ingresoGcc: number;
  /** Ya estaba repartido: no se tocó nada. */
  yaEstaba: boolean;
  /** Cobro de ensayo: todo a GCC, sin ganancias de nadie. */
  ensayo: boolean;
};

const PRECIO_ASIGNACION = `COALESCE(ra.member_cost, ra.proposed_cost, 0)`;

/** Los miembros que ganan algo en el proyecto: los de las asignaciones aceptadas, sin repetir. */
export async function beneficiariosDelProyecto(projectId: string | number, db: Consulta = pool): Promise<number[]> {
  const { rows } = await db.query(
    `SELECT DISTINCT ra.member_id
       FROM gcc_world.requirement_assignments ra
       JOIN gcc_world.project_requirements r ON r.id = ra.requirement_id
      WHERE r.project_id = ($1)::bigint AND ra.status = 'accepted' AND ra.member_id IS NOT NULL`,
    [String(projectId)],
  );
  return rows.map((r: any) => Number(r.member_id));
}

/** Mensajes de la regla «etapas solo con un único beneficiario» (una línea, Fernando 2026-11-09). */
export const SIN_ETAPAS_VARIOS = 'El pago por etapas solo es posible cuando el proyecto tiene un único beneficiario.';
export const SIN_SEGUNDO_CON_ETAPAS = 'El proyecto se cobra por etapas, que admiten un único beneficiario: quita el plan de etapas para aceptar a otro miembro.';

/** ¿Se puede definir un plan de etapas? `null` si sí; si no, el porqué. */
export async function motivoSinEtapas(projectId: string | number, db: Consulta = pool): Promise<string | null> {
  return (await beneficiariosDelProyecto(projectId, db)).length > 1 ? SIN_ETAPAS_VARIOS : null;
}

/**
 * ¿Se puede aceptar a `memberId` en el proyecto? Con un plan de etapas, solo si ya es el beneficiario o si
 * todavía no hay ninguno. `null` si sí; si no, el porqué.
 */
export async function motivoSinSegundoBeneficiario(projectId: string | number, memberId: number | string, db: Consulta = pool): Promise<string | null> {
  const { rows: [plan] } = await db.query(
    `SELECT EXISTS (SELECT 1 FROM gcc_world.project_stages WHERE project_id = ($1)::bigint) AS hay`, [String(projectId)],
  );
  if (!plan?.hay) return null;
  const actuales = await beneficiariosDelProyecto(projectId, db);
  return actuales.length === 0 || actuales.includes(Number(memberId)) ? null : SIN_SEGUNDO_CON_ETAPAS;
}

async function usuarioDelMiembro(memberId: number | null, db: Consulta): Promise<string | null> {
  if (memberId == null) return null;
  const { rows: [u] } = await db.query(
    `SELECT id FROM gcc_world.users WHERE member_id = $1 ORDER BY created_at NULLS LAST, id LIMIT 1`, [memberId],
  );
  return u?.id ?? null;
}

/** Reparte `total` entre pesos (`pesos` > 0), al centavo, y el último recoge el redondeo. */
function prorratear(total: number, pesos: number[]): number[] {
  const suma = pesos.reduce((s, p) => s + p, 0);
  if (!(suma > 0) || !(total > 0)) return pesos.map(() => 0);
  const out = pesos.map((p) => centavos(total * p / suma));
  out[out.length - 1] = centavos(total - out.slice(0, -1).reduce((s, x) => s + x, 0));
  return out;
}

/**
 * REPARTE EL COBRO DE UNA FACTURA. Corre dentro de la transacción de quien llama (`db` es su cliente: ver
 * gcc-pool-transaccion-un-cliente) y escribe el libro y los ingresos de cada persona a la vez, o nada.
 * Quien llama tiene que haber llamado antes a `ensureFinanceTables()` (hace DDL).
 */
export async function repartirCobro(
  invoiceId: number | string,
  db: Consulta,
  opts: { descripcion?: string; fecha?: Date } = {},
): Promise<Reparto> {
  const { rows: [inv] } = await db.query(
    `SELECT id, total, status, payment_intent_id, source_type, source_id, ticket_id, project_id
       FROM gcc_world.invoices WHERE id = ($1)::int FOR UPDATE`,
    [String(invoiceId)],
  );
  if (!inv) throw new Error(`La factura ${invoiceId} no existe.`);
  const id = Number(inv.id);

  const { rows: [intento] } = await db.query(
    `SELECT id, provider, provider_method, source_type, source_id, stage_id, net_amount, fee_amount, charge_amount, paid_at
       FROM gcc_world.payment_intents
      WHERE id = $1 OR (invoice_id = $2 AND status = 'paid')
      ORDER BY (id = $1) DESC LIMIT 1`,
    [inv.payment_intent_id ?? 0, id],
  );

  // ── El origen del cobro ──────────────────────────────────────────────────────────────────────────
  let sourceType = 'invoice';
  let sourceId = String(id);
  let stageId: number | null = intento?.stage_id != null ? Number(intento.stage_id) : null;
  if (inv.source_type === 'subscription' && inv.source_id) {
    sourceType = 'subscription'; sourceId = String(inv.source_id);
  } else if (intento?.source_type === 'ticket' || inv.source_type === 'ticket' || inv.ticket_id != null) {
    sourceType = 'ticket';
    sourceId = String(intento?.source_type === 'ticket' ? intento.source_id : inv.source_type === 'ticket' ? inv.source_id : inv.ticket_id);
  } else {
    let projectId: string | null = intento?.source_type === 'project' ? String(intento.source_id) : inv.project_id != null ? String(inv.project_id) : null;
    if (!projectId) {
      const { rows } = await db.query(`SELECT DISTINCT project_id FROM gcc_world.invoice_projects WHERE invoice_id = $1`, [id]);
      if (rows.length === 1) projectId = String(rows[0].project_id);
    }
    if (projectId) {
      sourceType = 'project'; sourceId = projectId;
      if (stageId == null && !intento) {
        const { rows: [e] } = await db.query(
          `SELECT id FROM gcc_world.project_stages WHERE invoice_id = $1 AND project_id = ($2)::bigint ORDER BY sort_order, id LIMIT 1`,
          [id, projectId],
        );
        if (e) stageId = Number(e.id);
      }
    }
  }

  // ── Los importes ─────────────────────────────────────────────────────────────────────────────────
  const cobro = centavos(intento ? Number(intento.charge_amount) || 0 : Number(inv.total) || 0);
  const recargo = intento ? centavos(Number(intento.fee_amount) || 0) : 0;
  const base = centavos(cobro - recargo);
  const metodo = intento ? (intento.provider_method || 'card') : 'manual';
  const comision = intento && metodo === 'card' && intento.provider !== 'manual'
    ? centavos(cobro - netoRecibido(cobro, tarifaDe(intento.provider)))
    : 0;
  // Si el cliente pagó un recargo (antes del 2026-09-30), ese recargo ya cubre la comisión.
  const comisionACargo = Math.max(0, centavos(comision - recargo));

  const base0: Omit<Reparto, 'partes' | 'ingresoGcc' | 'yaEstaba' | 'ensayo'> = { invoiceId: id, sourceType, sourceId, cobro, comision };

  // ── Idempotencia: si ya se repartió, se devuelve lo que hay ──────────────────────────────────────
  const { rows: previas } = await db.query(
    `SELECT user_id, member_id, role, share_key, requirement_id, assignment_id, stage_id, gross, commission, amount
       FROM gcc_world.member_earnings WHERE invoice_id = $1 AND status = 'accrued' ORDER BY id`,
    [id],
  );
  if (previas.length > 0) {
    const partes: Parte[] = previas.map((r: any) => ({
      userId: r.user_id, memberId: r.member_id != null ? Number(r.member_id) : null, role: r.role, shareKey: r.share_key,
      requirementId: r.requirement_id != null ? Number(r.requirement_id) : null,
      assignmentId: r.assignment_id != null ? Number(r.assignment_id) : null,
      stageId: r.stage_id != null ? Number(r.stage_id) : null,
      gross: Number(r.gross), commission: Number(r.commission), amount: Number(r.amount),
    }));
    return { ...base0, partes, ingresoGcc: ingresoDeGcc(cobro, partes), yaEstaba: true, ensayo: false };
  }
  if (inv.status === 'cancelled') throw new Error(`La factura ${id} está anulada: no se reparte.`);

  // ⚠️ UN COBRO DE ENSAYO NO CREA GANANCIAS: el proveedor simulado o el modo sin factura (`PAGOS_EMITIR_FACTURA=0`).
  const ensayo = intento?.provider === 'simulado' || process.env.PAGOS_EMITIR_FACTURA === '0';

  // ── Las partes de cada persona ───────────────────────────────────────────────────────────────────
  const partes: Parte[] = [];
  if (!ensayo && base > 0) {
    if (sourceType === 'ticket') {
      const { rows: [t] } = await db.query(`SELECT member_id FROM gcc_world.tickets WHERE id = ($1)::bigint`, [sourceId]);
      const memberId = t?.member_id != null ? Number(t.member_id) : null;
      const userId = await usuarioDelMiembro(memberId, db);
      if (userId) partes.push({ userId, memberId, role: 'ticket', shareKey: 'ticket', stageId, gross: base, commission: comisionACargo, amount: centavos(base - comisionACargo) });
    } else if (sourceType === 'subscription') {
      const subId = /^(\d+)-/.exec(sourceId)?.[1];
      const { rows: [s] } = subId
        ? await db.query(`SELECT owner_member_id FROM gcc_world.subscriptions WHERE id = ($1)::int`, [subId])
        : { rows: [] as any[] };
      const memberId = s?.owner_member_id != null ? Number(s.owner_member_id) : null;
      const userId = await usuarioDelMiembro(memberId, db);
      if (userId) partes.push({ userId, memberId, role: 'subscription', shareKey: 'subscription', gross: base, commission: comisionACargo, amount: centavos(base - comisionACargo) });
    } else if (sourceType === 'project') {
      const beneficiarios = await beneficiariosDelProyecto(sourceId, db);
      if (stageId != null) {
        // Etapa: entera al único beneficiario. Con varios (un plan anterior a la regla) no se adivina el
        // reparto: queda de GCC y se avisa para hacerlo a mano.
        if (beneficiarios.length === 1) {
          const userId = await usuarioDelMiembro(beneficiarios[0], db);
          if (userId) partes.push({ userId, memberId: beneficiarios[0], role: 'stage', shareKey: 'stage', stageId, gross: base, commission: comisionACargo, amount: centavos(base - comisionACargo) });
        } else if (beneficiarios.length > 1) {
          console.error(`[ganancias] la factura ${id} es de una etapa del proyecto ${sourceId}, que tiene ${beneficiarios.length} beneficiarios: queda de GCC.`);
        }
      } else {
        const { rows: asignaciones } = await db.query(
          `SELECT ir.requirement_id, ra.id AS assignment_id, ra.member_id, ${PRECIO_ASIGNACION} AS precio
             FROM gcc_world.invoice_requirements ir
             JOIN gcc_world.requirement_assignments ra ON ra.requirement_id = ir.requirement_id AND ra.status = 'accepted'
            WHERE ir.invoice_id = $1
            ORDER BY ir.requirement_id, ra.id`,
          [id],
        );
        const conUsuario: { a: any; userId: string }[] = [];
        for (const a of asignaciones) {
          if (!(Number(a.precio) > 0)) continue;
          const userId = await usuarioDelMiembro(a.member_id != null ? Number(a.member_id) : null, db);
          if (userId) conUsuario.push({ a, userId });
        }
        // Lo asignado nunca puede pasar de lo cobrado (un precio cambiado entre la cotización y el pago).
        const suma = conUsuario.reduce((s, x) => s + Number(x.a.precio), 0);
        const brutos = suma > base ? prorratear(base, conUsuario.map((x) => Number(x.a.precio))) : conUsuario.map((x) => centavos(Number(x.a.precio)));
        const individual = beneficiarios.length <= 1;
        const comisiones = individual
          // Individual: el beneficiario carga la comisión entera (repartida entre sus asignaciones).
          ? prorratear(comisionACargo, brutos)
          // Grupal: cada parte la suya, por lo que pesa en el cobro; el resto de la comisión es de GCC.
          : brutos.map((b) => (base > 0 ? centavos(comisionACargo * b / base) : 0));
        conUsuario.forEach((x, i) => partes.push({
          userId: x.userId, memberId: Number(x.a.member_id), role: 'assignment', shareKey: `a:${x.a.assignment_id}`,
          requirementId: Number(x.a.requirement_id), assignmentId: Number(x.a.assignment_id),
          gross: brutos[i], commission: comisiones[i], amount: centavos(brutos[i] - comisiones[i]),
        }));
      }
    }
  }

  // ── Lo de GCC: lo no atribuido y la comisión que nadie más carga ─────────────────────────────────
  const brutoGcc = centavos(cobro - partes.reduce((s, p) => s + p.gross, 0));
  const comisionGcc = centavos(comision - partes.reduce((s, p) => s + p.commission, 0));
  partes.push({ userId: DUENO_FINANZAS_GCC, memberId: null, role: 'gcc', shareKey: 'gcc', stageId, gross: brutoGcc, commission: comisionGcc, amount: centavos(brutoGcc - comisionGcc) });

  for (const p of partes) {
    await db.query(
      `INSERT INTO gcc_world.member_earnings
         (user_id, member_id, source_type, source_id, invoice_id, payment_intent_id, role, share_key,
          requirement_id, assignment_id, stage_id, gross, commission, amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (invoice_id, share_key) DO NOTHING`,
      [p.userId, p.memberId, sourceType, sourceId, id, intento?.id ?? null, p.role, p.shareKey,
       p.requirementId ?? null, p.assignmentId ?? null, p.stageId ?? null, p.gross.toFixed(2), p.commission.toFixed(2), p.amount.toFixed(2)],
    );
  }

  const ingresoGcc = ingresoDeGcc(cobro, partes);
  await anotarIngresos(db, id, sourceType, sourceId, partes, ingresoGcc, opts.descripcion || `Cobro — factura ${id}`, opts.fecha || (intento?.paid_at ? new Date(intento.paid_at) : new Date()));

  return { ...base0, partes, ingresoGcc, yaEstaba: false, ensayo };
}

/** El renglón de GCC: el cobro menos lo neto de quien no es la cuenta de GCC. */
function ingresoDeGcc(cobro: number, partes: Parte[]): number {
  return centavos(cobro - partes.filter((p) => p.userId !== DUENO_FINANZAS_GCC).reduce((s, p) => s + p.amount, 0));
}

/** Un renglón por persona y factura (`earning`/`<factura>:<usuario>`), y el de GCC con el origen de siempre. */
async function anotarIngresos(
  db: Consulta, invoiceId: number, sourceType: string, sourceId: string, partes: Parte[], ingresoGcc: number,
  descripcion: string, fecha: Date,
) {
  const porUsuario = new Map<string, number>();
  for (const p of partes) {
    if (p.userId === DUENO_FINANZAS_GCC) continue;
    porUsuario.set(p.userId, centavos((porUsuario.get(p.userId) || 0) + p.amount));
  }
  for (const [userId, monto] of porUsuario) {
    if (monto > 0) await anotarIngreso(db, userId, 'earning', `${invoiceId}:${userId}`, descripcion, monto, fecha);
  }

  // El de GCC conserva el origen que tenía (la suscripción por su mes, lo demás por la factura): es el que
  // saben revertir la anulación y «Marcar pagado».
  const [tipoGcc, idGcc] = sourceType === 'subscription' ? ['subscription', sourceId] : ['invoice', String(invoiceId)];
  if (ingresoGcc > 0) await anotarIngreso(db, DUENO_FINANZAS_GCC, tipoGcc, idGcc, descripcion, ingresoGcc, fecha);
  else await apuntarOrigen(db, tipoGcc, idGcc);

  // ⚠️ El ticket o el proyecto cobrado ya no se anota por su costo entero: su ingreso va por la factura. Sin
  // esto, el relleno de `/api/finance` sumaría el costo del proyecto completado a la cuenta de GCC.
  if (sourceType === 'ticket' || sourceType === 'project') await apuntarOrigen(db, sourceType, sourceId);
}

function apuntarOrigen(db: Consulta, tipo: string, id: string) {
  return db.query(
    `INSERT INTO gcc_world.finance_source_log (source_type, source_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [tipo, id],
  );
}

/** Corre `trabajo` en una transacción con su propio cliente. */
async function enTransaccion<T>(trabajo: (db: Consulta) => Promise<T>): Promise<T> {
  await ensureFinanceTables();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await trabajo(client);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** `repartirCobro` en su propia transacción: lo que llama el cobro confirmado (`lib/pagos/intentos.ts`). */
export function registrarCobro(invoiceId: number | string, opts: { descripcion?: string; fecha?: Date } = {}): Promise<Reparto> {
  return enTransaccion((db) => repartirCobro(invoiceId, db, opts));
}

/**
 * AL ANULAR LA FACTURA, LAS GANANCIAS SE REVIERTEN: el libro queda `reversed` (no se borra: es la historia del
 * dinero) y se quitan los renglones de cada persona. El registro de orígenes se conserva, como en
 * `quitarIngresosDeFacturaAnulada`. El renglón de GCC lo quita la anulación por su camino de siempre.
 */
export async function revertirGanancias(invoiceId: number | string, db: Consulta = pool): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE gcc_world.member_earnings SET status = 'reversed', reversed_at = NOW()
      WHERE invoice_id = ($1)::int AND status = 'accrued'`,
    [String(invoiceId)],
  );
  const { rows } = await db.query(
    `DELETE FROM gcc_world.finance_items WHERE source_type = 'earning' AND split_part(source_id, ':', 1) = ($1)::text
     RETURNING month_id`,
    [String(invoiceId)],
  );
  for (const m of new Set(rows.map((r: any) => Number(r.month_id)))) await recalcMonth(m, db);
  return rowCount ?? 0;
}

/**
 * REFACTURA: la factura nueva hereda el reparto de la anulada —las mismas personas, con lo mismo, porque el cobro
 * y su comisión fueron los de entonces— y el renglón de GCC de la nueva baja en lo que va a los demás. Sin esto la
 * refactura se anotaría entera a GCC y quien trabajó perdería su ganancia; y repartirla otra vez desde cero
 * contaría dos veces lo que ya se repartió. No hace nada si la anulada no tenía reparto o la nueva ya lo tiene.
 */
export function heredarGanancias(anuladaId: number | string, nuevaId: number | string, descripcion?: string): Promise<number> {
  return enTransaccion((db) => heredarGananciasEn(db, anuladaId, nuevaId, descripcion));
}

/** `heredarGanancias` con el cliente de una transacción ya abierta. */
export async function heredarGananciasEn(db: Consulta, anuladaId: number | string, nuevaId: number | string, descripcion?: string): Promise<number> {
  const { rows: [nueva] } = await db.query(
    `SELECT id, total FROM gcc_world.invoices WHERE id = ($1)::int FOR UPDATE`, [String(nuevaId)],
  );
  if (!nueva) return 0;
  const { rows: [ya] } = await db.query(
    `SELECT EXISTS (SELECT 1 FROM gcc_world.member_earnings WHERE invoice_id = ($1)::int) AS hay`, [String(nuevaId)],
  );
  if (ya.hay) return 0;
  const { rows: viejas } = await db.query(
    `SELECT * FROM gcc_world.member_earnings WHERE invoice_id = ($1)::int ORDER BY id`, [String(anuladaId)],
  );
  const ajenas = viejas.filter((r: any) => r.role !== 'gcc');
  if (ajenas.length === 0) return 0;

  const total = centavos(Number(nueva.total) || 0);
  const gcc = viejas.find((r: any) => r.role === 'gcc');
  const brutoGcc = centavos(total - ajenas.reduce((s: number, r: any) => s + Number(r.gross), 0));
  const comisionGcc = gcc ? Number(gcc.commission) : 0;
  const filas = [
    ...ajenas,
    { ...(gcc || { user_id: DUENO_FINANZAS_GCC, member_id: null, role: 'gcc', share_key: 'gcc' }), gross: brutoGcc, commission: comisionGcc, amount: centavos(brutoGcc - comisionGcc) },
  ];
  const base = viejas[0];
  for (const r of filas) {
    await db.query(
      `INSERT INTO gcc_world.member_earnings
         (user_id, member_id, source_type, source_id, invoice_id, payment_intent_id, role, share_key,
          requirement_id, assignment_id, stage_id, gross, commission, amount, inherited_from)
       VALUES ($1, $2, $3, $4, ($5)::int, $6, $7, $8, $9, $10, $11, $12, $13, $14, ($15)::int)
       ON CONFLICT (invoice_id, share_key) DO NOTHING`,
      [r.user_id, r.member_id ?? null, base.source_type, base.source_id, String(nuevaId), base.payment_intent_id ?? null,
       r.role, r.share_key, r.requirement_id ?? null, r.assignment_id ?? null, r.stage_id ?? null,
       Number(r.gross).toFixed(2), Number(r.commission).toFixed(2), Number(r.amount).toFixed(2), String(anuladaId)],
    );
  }

  // Los renglones de cada persona, y el de GCC (`invoice`/<nueva>, ya anotado por quien llama) baja en lo suyo.
  const porUsuario = new Map<string, number>();
  for (const r of ajenas) {
    if (r.user_id === DUENO_FINANZAS_GCC) continue;
    porUsuario.set(r.user_id, centavos((porUsuario.get(r.user_id) || 0) + Number(r.amount)));
  }
  let aOtros = 0;
  for (const [userId, monto] of porUsuario) {
    if (monto > 0 && await anotarIngreso(db, userId, 'earning', `${nuevaId}:${userId}`, descripcion || `Refactura — factura ${nuevaId}`, monto)) aOtros += monto;
  }
  if (aOtros > 0) {
    const { rows } = await db.query(
      `UPDATE gcc_world.finance_items SET amount = GREATEST(0, amount - $2)
        WHERE source_type = 'invoice' AND source_id = ($1)::text RETURNING month_id`,
      [String(nuevaId), centavos(aOtros).toFixed(2)],
    );
    for (const m of rows) await recalcMonth(Number(m.month_id), db);
  }
  return porUsuario.size;
}
