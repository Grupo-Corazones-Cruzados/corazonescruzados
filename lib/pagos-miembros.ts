import { pool } from '@/lib/db';
import { DUENO_FINANZAS_GCC, type Consulta } from '@/lib/finance';
import { cifrar, descifrar, contextoCuentaBancaria } from '@/lib/cifrado';
import { centavos } from '@/lib/pagos/comision';
import { money } from '@/lib/format';
import { deducirIdentificacion, PAIS_LOCAL } from '@/lib/pagos/identificacion';

/**
 * ⭐ PAGOS A MIEMBROS — fase 4, paso 2 del modelo económico (Fernando, 2026-11-09; ver MEMORIA.md ›
 * «EL MODELO ECONÓMICO DE LA PLATAFORMA» › «Reparto»).
 *
 * GCC cobra todo (`lib/ganancias.ts` anota en `member_earnings` lo que gana cada uno) y después le transfiere a
 * cada miembro o candidato lo suyo. Aquí viven la cuenta bancaria de cada persona y los pagos.
 *
 *   · SALDO = lo ganado y no pagado (`accrued`, sin `payout_id`) − lo que se revirtió DESPUÉS de pagado y aún no
 *     se descontó (`reversed`, con `payout_id`, sin `deducted_payout_id`). Una ganancia revertida nunca se paga.
 *   · REGISTRAR un pago toma las pendientes (todas o las elegidas) y TODOS los descuentos pendientes, en una
 *     transacción con su propio cliente (ver gcc-pool-transaccion-un-cliente); total = suma de unas − otras.
 *   · ANULAR un pago suelta sus ganancias y sus descuentos, que vuelven al saldo.
 *
 * Lo de GCC no se paga a nadie: ni el renglón `gcc` ni lo que gana la cuenta de Fernando (`DUENO_FINANZAS_GCC`),
 * que ES la cuenta de GCC.
 *
 * ⚠️ Las tablas las crea la migración 088; aquí no hay DDL (gcc-listas-sin-ddl-ni-fila).
 */

/** Las ganancias que se le pagan a alguien: ni el renglón de GCC ni la cuenta de GCC. */
const PAGABLE = `e.role <> 'gcc' AND e.user_id <> '${DUENO_FINANZAS_GCC}'::uuid`;

export type TipoCuenta = 'ahorros' | 'corriente';

export type CuentaVisible = {
  titular: string;
  identificacion: string;
  banco: string;
  tipo: TipoCuenta;
  ultimos4: string;
  actualizada: string;
};

export type CuentaDescifrada = CuentaVisible & { numero: string };

export type EstadoGanancia = 'pendiente' | 'pagado' | 'revertido';

export type Ganancia = {
  id: number;
  fecha: string;
  origen: 'ticket' | 'project' | 'subscription' | string;
  origenId: string;
  titulo: string | null;
  requisito: string | null;
  factura: number;
  bruto: number;
  comision: number;
  neto: number;
  estado: EstadoGanancia;
  /** Revertida después de pagada y aún sin descontar: se resta del próximo pago. */
  porDescontar: boolean;
  pagoId: number | null;
};

export type Pago = {
  id: number;
  userId: string;
  persona?: string;
  total: number;
  referencia: string;
  fecha: string;
  nota: string | null;
  estado: 'paid' | 'voided';
  comprobante: { nombre: string; mime: string } | null;
  banco: string | null;
  tipo: string | null;
  ultimos4: string | null;
  titular: string | null;
  creado: string;
};

export type Saldo = { pendiente: number; descuento: number; saldo: number; pagado: number };

const num = (v: unknown) => centavos(Number(v) || 0);
const dia = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10));

// ── La cuenta bancaria ───────────────────────────────────────────────────────────────────────────

function visible(r: any): CuentaVisible {
  return {
    titular: r.holder_name, identificacion: r.holder_id_number, banco: r.bank_name, tipo: r.account_type,
    ultimos4: r.account_last4, actualizada: new Date(r.updated_at).toISOString(),
  };
}

/** La cuenta sin el número (solo los 4 últimos). `null` si no hay. */
export async function cuentaDe(userId: string, db: Consulta = pool): Promise<CuentaVisible | null> {
  const { rows: [r] } = await db.query(
    `SELECT holder_name, holder_id_number, bank_name, account_type, account_last4, updated_at
       FROM gcc_world.member_bank_accounts WHERE user_id = $1::uuid`, [userId],
  );
  return r ? visible(r) : null;
}

/**
 * La cuenta CON el número, para el administrador que registra un pago. Deja escrito quién la vio.
 * Lanza si no se puede descifrar (clave cambiada): mejor un error que transferir a un número inventado.
 */
export async function cuentaDescifrada(userId: string, actor: string): Promise<CuentaDescifrada | null> {
  const { rows: [r] } = await pool.query(
    `SELECT holder_name, holder_id_number, bank_name, account_type, account_last4, account_number_enc, updated_at
       FROM gcc_world.member_bank_accounts WHERE user_id = $1::uuid`, [userId],
  );
  if (!r) return null;
  const numero = descifrar(r.account_number_enc, contextoCuentaBancaria(userId));
  await pool.query(
    `INSERT INTO gcc_world.member_bank_account_log (user_id, action, account_last4, actor_user_id)
     VALUES ($1::uuid, 'viewed', $2, $3::uuid)`, [userId, r.account_last4, actor],
  );
  return { ...visible(r), numero };
}

export type DatosCuenta = { titular?: unknown; identificacion?: unknown; banco?: unknown; tipo?: unknown; numero?: unknown };

/**
 * Guarda la cuenta de `userId` (la llama SOLO su dueño: ver `/api/cobros/cuenta`). El número vacío al editar
 * conserva el que había. Devuelve la cuenta visible y qué cambió, o el error para la pantalla.
 */
export async function guardarCuenta(userId: string, datos: DatosCuenta): Promise<
  { ok: true; cuenta: CuentaVisible; cambios: string[]; nueva: boolean } | { ok: false; error: string }
> {
  const titular = String(datos.titular ?? '').trim().replace(/\s+/g, ' ');
  const identificacion = String(datos.identificacion ?? '').replace(/\s+/g, '');
  const banco = String(datos.banco ?? '').trim().replace(/\s+/g, ' ');
  const tipo = String(datos.tipo ?? '');
  const numero = String(datos.numero ?? '').replace(/[\s-]+/g, '');

  if (titular.length < 3 || titular.length > 120) return { ok: false, error: 'Escribe el nombre del titular de la cuenta.' };
  const id = deducirIdentificacion(PAIS_LOCAL, identificacion);
  if (!id.ok) return { ok: false, error: id.error };
  if (banco.length < 2 || banco.length > 80) return { ok: false, error: 'Escribe el nombre del banco.' };
  if (tipo !== 'ahorros' && tipo !== 'corriente') return { ok: false, error: 'Elige el tipo de cuenta.' };
  if (numero && !/^\d{5,20}$/.test(numero)) return { ok: false, error: 'El número de cuenta lleva solo dígitos (entre 5 y 20).' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [antes] } = await client.query(
      `SELECT holder_name, holder_id_number, bank_name, account_type, account_number_enc, account_last4
         FROM gcc_world.member_bank_accounts WHERE user_id = $1::uuid FOR UPDATE`, [userId],
    );
    if (!antes && !numero) { await client.query('ROLLBACK'); return { ok: false, error: 'Escribe el número de cuenta.' }; }

    let numeroCambia = !!numero;
    if (antes && numero) {
      try { numeroCambia = descifrar(antes.account_number_enc, contextoCuentaBancaria(userId)) !== numero; } catch { numeroCambia = true; }
    }
    const cambios: string[] = [];
    if (!antes || antes.holder_name !== titular) cambios.push('holder_name');
    if (!antes || antes.holder_id_number !== identificacion) cambios.push('holder_id_number');
    if (!antes || antes.bank_name !== banco) cambios.push('bank_name');
    if (!antes || antes.account_type !== tipo) cambios.push('account_type');
    if (!antes || numeroCambia) cambios.push('account_number');

    const enc = numeroCambia ? cifrar(numero, contextoCuentaBancaria(userId)) : antes.account_number_enc;
    const ultimos4 = numeroCambia ? numero.slice(-4) : antes.account_last4;

    if (cambios.length > 0) {
      await client.query(
        `INSERT INTO gcc_world.member_bank_accounts
           (user_id, holder_name, holder_id_number, bank_name, account_type, account_number_enc, account_last4, updated_at, updated_by)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, NOW(), $1::uuid)
         ON CONFLICT (user_id) DO UPDATE SET
           holder_name = EXCLUDED.holder_name, holder_id_number = EXCLUDED.holder_id_number,
           bank_name = EXCLUDED.bank_name, account_type = EXCLUDED.account_type,
           account_number_enc = EXCLUDED.account_number_enc, account_last4 = EXCLUDED.account_last4,
           updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [userId, titular, identificacion, banco, tipo, enc, ultimos4],
      );
      await client.query(
        `INSERT INTO gcc_world.member_bank_account_log (user_id, action, changed_fields, account_last4, actor_user_id)
         VALUES ($1::uuid, $2, $3::text[], $4, $1::uuid)`,
        [userId, antes ? 'updated' : 'created', cambios, ultimos4],
      );
    }
    await client.query('COMMIT');
    const cuenta = await cuentaDe(userId);
    return { ok: true, cuenta: cuenta!, cambios, nueva: !antes };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ── Las ganancias y los pagos ────────────────────────────────────────────────────────────────────

const SELECT_GANANCIA = `
  SELECT e.id, e.created_at, e.source_type, e.source_id, e.invoice_id, e.gross, e.commission, e.amount, e.status,
         e.payout_id, e.deducted_payout_id,
         CASE e.source_type WHEN 'ticket' THEN t.title WHEN 'project' THEN p.title WHEN 'subscription' THEN s.title END AS titulo,
         r.title AS requisito
    FROM gcc_world.member_earnings e
    LEFT JOIN gcc_world.tickets t ON e.source_type = 'ticket' AND t.id::text = e.source_id
    LEFT JOIN gcc_world.projects p ON e.source_type = 'project' AND p.id::text = e.source_id
    LEFT JOIN gcc_world.subscriptions s ON e.source_type = 'subscription' AND s.id::text = split_part(e.source_id, '-', 1)
    LEFT JOIN gcc_world.project_requirements r ON r.id = e.requirement_id`;

function ganancia(r: any): Ganancia {
  const estado: EstadoGanancia = r.status === 'reversed' ? 'revertido' : r.payout_id != null ? 'pagado' : 'pendiente';
  return {
    id: Number(r.id), fecha: new Date(r.created_at).toISOString(), origen: r.source_type, origenId: String(r.source_id),
    titulo: r.titulo ?? null, requisito: r.requisito ?? null, factura: Number(r.invoice_id),
    bruto: num(r.gross), comision: num(r.commission), neto: num(r.amount), estado,
    porDescontar: r.status === 'reversed' && r.payout_id != null && r.deducted_payout_id == null,
    pagoId: r.payout_id != null ? Number(r.payout_id) : null,
  };
}

const SELECT_PAGO = `
  SELECT m.id, m.user_id, m.total, m.reference, m.paid_at, m.note, m.status, m.proof_file_id, m.proof_name, m.proof_mime,
         m.bank_name, m.account_type, m.account_last4, m.holder_name, m.created_at,
         NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS persona, u.email
    FROM gcc_world.member_payouts m
    LEFT JOIN gcc_world.users u ON u.id = m.user_id`;

function pago(r: any): Pago {
  return {
    id: Number(r.id), userId: r.user_id, persona: r.persona || r.email || undefined, total: num(r.total),
    referencia: r.reference, fecha: dia(r.paid_at), nota: r.note ?? null, estado: r.status,
    comprobante: r.proof_file_id ? { nombre: r.proof_name || 'Comprobante', mime: r.proof_mime || 'application/octet-stream' } : null,
    banco: r.bank_name ?? null, tipo: r.account_type ?? null, ultimos4: r.account_last4 ?? null, titular: r.holder_name ?? null,
    creado: new Date(r.created_at).toISOString(),
  };
}

function saldoDe(ganancias: Ganancia[], pagos: Pago[]): Saldo {
  const pendiente = centavos(ganancias.filter((g) => g.estado === 'pendiente').reduce((s, g) => s + g.neto, 0));
  const descuento = centavos(ganancias.filter((g) => g.porDescontar).reduce((s, g) => s + g.neto, 0));
  const pagado = centavos(pagos.filter((p) => p.estado === 'paid').reduce((s, p) => s + p.total, 0));
  return { pendiente, descuento, saldo: centavos(pendiente - descuento), pagado };
}

/** Todo lo de UNA persona: sus ganancias, sus pagos y su saldo. Para «Mis cobros» y el panel del admin. */
export async function cobrosDe(userId: string): Promise<{ ganancias: Ganancia[]; pagos: Pago[]; saldo: Saldo }> {
  const [g, p] = await Promise.all([
    pool.query(`${SELECT_GANANCIA} WHERE e.user_id = $1::uuid AND ${PAGABLE} ORDER BY e.created_at DESC, e.id DESC`, [userId]),
    pool.query(`${SELECT_PAGO} WHERE m.user_id = $1::uuid ORDER BY m.paid_at DESC, m.id DESC`, [userId]),
  ]);
  const ganancias = g.rows.map(ganancia);
  const pagos = p.rows.map(pago);
  return { ganancias, pagos, saldo: saldoDe(ganancias, pagos) };
}

export type PersonaPorPagar = {
  userId: string;
  nombre: string;
  email: string;
  pendiente: number;
  descuento: number;
  saldo: number;
  pagado: number;
  pagos: number;
  ultimoPago: string | null;
  tieneCuenta: boolean;
};

/** Las personas con algo ganado o pagado, con su saldo. Para la lista del admin. */
export async function personasPorPagar(): Promise<PersonaPorPagar[]> {
  const { rows } = await pool.query(
    `WITH g AS (
       SELECT e.user_id,
              COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'accrued' AND e.payout_id IS NULL), 0) AS pendiente,
              COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'reversed' AND e.payout_id IS NOT NULL AND e.deducted_payout_id IS NULL), 0) AS descuento
         FROM gcc_world.member_earnings e WHERE ${PAGABLE} GROUP BY e.user_id
     ), p AS (
       SELECT user_id, COUNT(*) AS pagos, SUM(total) AS pagado, MAX(paid_at) AS ultimo
         FROM gcc_world.member_payouts WHERE status = 'paid' GROUP BY user_id
     ), x AS (SELECT user_id FROM g UNION SELECT user_id FROM p)
     SELECT u.id, u.email, NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS nombre,
            COALESCE(g.pendiente, 0) AS pendiente, COALESCE(g.descuento, 0) AS descuento,
            COALESCE(p.pagos, 0) AS pagos, COALESCE(p.pagado, 0) AS pagado, p.ultimo,
            (b.user_id IS NOT NULL) AS tiene_cuenta
       FROM x
       JOIN gcc_world.users u ON u.id = x.user_id
       LEFT JOIN g ON g.user_id = x.user_id
       LEFT JOIN p ON p.user_id = x.user_id
       LEFT JOIN gcc_world.member_bank_accounts b ON b.user_id = x.user_id`,
  );
  return rows
    .map((r: any) => {
      const pendiente = num(r.pendiente), descuento = num(r.descuento);
      return {
        userId: r.id, nombre: r.nombre || r.email, email: r.email, pendiente, descuento, saldo: centavos(pendiente - descuento),
        pagado: num(r.pagado), pagos: Number(r.pagos) || 0, ultimoPago: r.ultimo ? dia(r.ultimo) : null, tieneCuenta: !!r.tiene_cuenta,
      };
    })
    .sort((a: PersonaPorPagar, b: PersonaPorPagar) => b.saldo - a.saldo || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Los pagos registrados, de todos (los más recientes primero). */
export async function pagosRegistrados(limite = 500): Promise<Pago[]> {
  const { rows } = await pool.query(`${SELECT_PAGO} ORDER BY m.paid_at DESC, m.id DESC LIMIT $1`, [limite]);
  return rows.map(pago);
}

/** Un pago con lo que pagó y lo que descontó. `null` si no existe. */
export async function detallePago(id: number): Promise<{ pago: Pago; ganancias: Ganancia[]; descuentos: Ganancia[] } | null> {
  const { rows: [r] } = await pool.query(`${SELECT_PAGO} WHERE m.id = $1`, [id]);
  if (!r) return null;
  const { rows } = await pool.query(
    `${SELECT_GANANCIA} WHERE e.payout_id = $1 OR e.deducted_payout_id = $1 ORDER BY e.created_at, e.id`, [id],
  );
  return {
    pago: pago(r),
    ganancias: rows.filter((x: any) => Number(x.payout_id) === id).map(ganancia),
    descuentos: rows.filter((x: any) => Number(x.deducted_payout_id) === id).map(ganancia),
  };
}

/** El comprobante de un pago, para servirlo desde Drive. `null` si no tiene o el pago no existe. */
export async function comprobanteDe(id: number): Promise<{ userId: string; fileId: string; nombre: string; mime: string } | null> {
  const { rows: [r] } = await pool.query(
    `SELECT user_id, proof_file_id, proof_name, proof_mime FROM gcc_world.member_payouts WHERE id = $1`, [id],
  );
  return r?.proof_file_id ? { userId: r.user_id, fileId: r.proof_file_id, nombre: r.proof_name || 'Comprobante', mime: r.proof_mime || 'application/octet-stream' } : null;
}

export class ErrorPago extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

/**
 * REGISTRA UN PAGO. Toma las ganancias pendientes de `userId` (todas, o las de `ids`) y todos sus descuentos
 * pendientes, en una transacción con su propio cliente y un candado por persona: dos pagos a la vez a la misma
 * persona no pueden llevarse la misma ganancia. `esperado` es el total que vio el administrador: si cambió
 * entre abrir el panel y guardar (una factura anulada, un cobro nuevo), no se paga otra cifra sin que la vea.
 */
export async function registrarPago(o: {
  userId: string; ids?: number[] | null; esperado: number; referencia: string; fecha: string; nota?: string | null;
  comprobante?: { fileId: string; nombre: string; mime: string } | null; actor: string;
}): Promise<{ id: number; total: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('member_payouts:' || $1))`, [o.userId]);

    const { rows: [cuenta] } = await client.query(
      `SELECT holder_name, holder_id_number, bank_name, account_type, account_last4
         FROM gcc_world.member_bank_accounts WHERE user_id = $1::uuid`, [o.userId],
    );
    if (!cuenta) throw new ErrorPago('Esta persona no tiene una cuenta bancaria registrada.');

    const { rows: pendientes } = await client.query(
      `SELECT e.id, e.amount FROM gcc_world.member_earnings e
        WHERE e.user_id = $1::uuid AND ${PAGABLE} AND e.status = 'accrued' AND e.payout_id IS NULL
        ORDER BY e.id FOR UPDATE`, [o.userId],
    );
    let elegidas = pendientes;
    if (o.ids && o.ids.length > 0) {
      const pedidas = new Set(o.ids.map(Number));
      elegidas = pendientes.filter((r: any) => pedidas.has(Number(r.id)));
      if (elegidas.length !== pedidas.size) throw new ErrorPago('Alguna de las ganancias elegidas ya no está pendiente. Vuelve a abrir el panel.');
    }
    if (elegidas.length === 0) throw new ErrorPago('No hay ganancias pendientes que pagar.');

    const { rows: descuentos } = await client.query(
      `SELECT e.id, e.amount FROM gcc_world.member_earnings e
        WHERE e.user_id = $1::uuid AND ${PAGABLE} AND e.status = 'reversed' AND e.payout_id IS NOT NULL AND e.deducted_payout_id IS NULL
        ORDER BY e.id FOR UPDATE`, [o.userId],
    );
    const total = centavos(
      elegidas.reduce((s: number, r: any) => s + Number(r.amount), 0) - descuentos.reduce((s: number, r: any) => s + Number(r.amount), 0),
    );
    if (Math.abs(total - centavos(o.esperado)) > 0.004) {
      throw new ErrorPago(`El total cambió: ahora es ${money(total)}. Vuelve a abrir el panel.`);
    }
    if (!(total > 0)) throw new ErrorPago('El total a pagar tiene que ser mayor que cero.');

    const { rows: [nuevo] } = await client.query(
      `INSERT INTO gcc_world.member_payouts
         (user_id, total, method, reference, proof_file_id, proof_name, proof_mime, note,
          holder_name, holder_id_number, bank_name, account_type, account_last4, paid_at, created_by)
       VALUES ($1::uuid, $2, 'transferencia', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ($13)::date, $14::uuid)
       RETURNING id`,
      [o.userId, total.toFixed(2), o.referencia, o.comprobante?.fileId ?? null, o.comprobante?.nombre ?? null, o.comprobante?.mime ?? null,
       o.nota || null, cuenta.holder_name, cuenta.holder_id_number, cuenta.bank_name, cuenta.account_type, cuenta.account_last4,
       o.fecha, o.actor],
    );
    const id = Number(nuevo.id);
    await client.query(`UPDATE gcc_world.member_earnings SET payout_id = $1 WHERE id = ANY($2::bigint[])`, [id, elegidas.map((r: any) => r.id)]);
    if (descuentos.length > 0) {
      await client.query(`UPDATE gcc_world.member_earnings SET deducted_payout_id = $1 WHERE id = ANY($2::bigint[])`, [id, descuentos.map((r: any) => r.id)]);
    }
    await client.query('COMMIT');
    return { id, total };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * ANULA UN PAGO: queda `voided` (no se borra: es la historia del dinero) y sus ganancias y descuentos vuelven al
 * saldo. Si una ganancia de este pago se revirtió y ya se descontó en OTRO pago, anularlo dejaría ese descuento
 * de más: primero se anula aquel.
 */
export async function anularPago(id: number, actor: string): Promise<{ userId: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [p] } = await client.query(`SELECT id, user_id, status FROM gcc_world.member_payouts WHERE id = $1 FOR UPDATE`, [id]);
    if (!p) throw new ErrorPago('Ese pago no existe.', 404);
    if (p.status !== 'paid') throw new ErrorPago('Ese pago ya está anulado.');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('member_payouts:' || $1))`, [p.user_id]);

    const { rows: [otro] } = await client.query(
      `SELECT deducted_payout_id FROM gcc_world.member_earnings
        WHERE payout_id = $1 AND deducted_payout_id IS NOT NULL AND deducted_payout_id <> $1 LIMIT 1`, [id],
    );
    if (otro) throw new ErrorPago(`Una ganancia de este pago ya se descontó en el pago #${otro.deducted_payout_id}: anula primero ese.`);

    await client.query(`UPDATE gcc_world.member_earnings SET payout_id = NULL WHERE payout_id = $1`, [id]);
    await client.query(`UPDATE gcc_world.member_earnings SET deducted_payout_id = NULL WHERE deducted_payout_id = $1`, [id]);
    await client.query(
      `UPDATE gcc_world.member_payouts SET status = 'voided', voided_at = NOW(), voided_by = $2::uuid WHERE id = $1`, [id, actor],
    );
    await client.query('COMMIT');
    return { userId: p.user_id };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** ¿Puede tener cuenta de cobro? Quien tiene ficha de miembro (miembros, candidatos y el admin). */
export async function puedeCobrar(userId: string): Promise<boolean> {
  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1::uuid`, [userId]);
  return u?.member_id != null;
}

/** Nombre y correo de una persona, para avisarle. */
export async function contactoDe(userId: string): Promise<{ nombre: string; email: string } | null> {
  const { rows: [u] } = await pool.query(
    `SELECT email, NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), '') AS nombre FROM gcc_world.users WHERE id = $1::uuid`, [userId],
  );
  return u ? { nombre: u.nombre || u.email, email: u.email } : null;
}
