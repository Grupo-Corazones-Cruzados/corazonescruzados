import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { secretoServidor } from '@/lib/auth/secreto';
import { pool } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { upsertBillingForClient, CONSUMIDOR_FINAL_RUC } from '@/lib/billing-clients';
import { sendCodigoDeAccesoEmail } from '@/lib/integrations/email';
import { anotarRegistro } from '@/lib/registro/limite';
import { ensureUserClientAccount } from '@/lib/tickets/clientAccount';
import { anunciarTicket } from '@/lib/tickets/alta';
import type { Presupuesto } from './db';

/**
 * ACEPTAR EL PRESUPUESTO. Nada se publica hasta confirmar el correo con un código: si no, cualquiera
 * podría escribir el RUC de otro y colgarle un proyecto. Por lo mismo, escribir una identificación nunca
 * devuelve los datos del cliente, solo su correo enmascarado. Ver `gcc-hay-sesion-no-es-tuyo`.
 */

const MINUTOS_CODIGO = 10;
const MAX_INTENTOS = 5;

const secreto = () => secretoServidor();
const firmar = (sesion: string, codigo: string) => createHmac('sha256', secreto()).update(`${sesion}:${codigo}`).digest('hex');

export const limpiarId = (x: unknown) => String(x ?? '').trim().replace(/[\s.-]/g, '').toUpperCase().slice(0, 20);

export function enmascarar(correo: string): string {
  const [u, d] = correo.split('@');
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`;
}

/** El cliente de esa identificación, si tiene un correo al que confirmar. */
export async function clientePorIdentificacion(id: string): Promise<{ correo: string; nombre: string; clientId: number | null } | null> {
  if (id.length < 5 || id === CONSUMIDOR_FINAL_RUC) return null;
  const { rows: [b] } = await pool.query(
    `SELECT b.email, b.name, COALESCE(b.portal_client_id, h.portal_client_id) AS client_id
       FROM gcc_world.billing_clients b
       LEFT JOIN gcc_world.billing_clients h ON h.id = b.titular_id
      WHERE UPPER(REGEXP_REPLACE(b.ruc, '[[:space:].-]', '', 'g')) = $1 AND NULLIF(b.email, '') IS NOT NULL
      ORDER BY b.id LIMIT 1`,
    [id],
  );
  if (b) return { correo: String(b.email).trim().toLowerCase(), nombre: b.name, clientId: b.client_id != null ? Number(b.client_id) : null };
  const { rows: [c] } = await pool.query(
    `SELECT id, email, name FROM gcc_world.clients WHERE UPPER(REGEXP_REPLACE(ruc, '[[:space:].-]', '', 'g')) = $1 AND NULLIF(email, '') IS NOT NULL ORDER BY id LIMIT 1`, [id],
  );
  return c ? { correo: String(c.email).trim().toLowerCase(), nombre: c.name, clientId: Number(c.id) } : null;
}

export type Pendiente = {
  correo: string;
  nombre: string;
  clientId: number | null;
  codigo: string;
  expira: number;
  intentos: number;
  enviado: number;
  /** Solo en un alta. La contraseña ya va cifrada. */
  alta?: { identificacion: string; idType: string; telefono: string; pais: string; direccion: string; hash: string };
};

export async function enviarCodigo(sesionId: string, datos: Omit<Pendiente, 'codigo' | 'expira' | 'intentos' | 'enviado'>, anterior: Pendiente | null) {
  if (anterior && Date.now() - anterior.enviado < 60_000) throw new Error('Espera un minuto para pedir otro código.');
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const pendiente: Pendiente = {
    ...datos, codigo: firmar(sesionId, codigo), expira: Date.now() + MINUTOS_CODIGO * 60_000, intentos: 0, enviado: Date.now(),
  };
  await pool.query(`UPDATE gcc_world.presupuesto_sesiones SET solicitud = $2::jsonb WHERE id = $1`, [sesionId, JSON.stringify(pendiente)]);
  await sendCodigoDeAccesoEmail(datos.correo, codigo, datos.nombre || 'Hola');
}

export const hashDeClave = hashPassword;

/** ¿Es correcto el código? Cuenta el intento. */
export async function comprobarCodigo(sesionId: string, p: Pendiente, codigo: string): Promise<string | null> {
  if (Date.now() > p.expira) return 'El código caducó. Pide otro.';
  if (p.intentos >= MAX_INTENTOS) return 'Demasiados intentos. Pide otro código.';
  const a = Buffer.from(firmar(sesionId, String(codigo).trim()));
  const b = Buffer.from(p.codigo);
  if (a.length === b.length && timingSafeEqual(a, b)) return null;
  await pool.query(
    `UPDATE gcc_world.presupuesto_sesiones SET solicitud = jsonb_set(solicitud, '{intentos}', to_jsonb($2::int)) WHERE id = $1`,
    [sesionId, p.intentos + 1],
  );
  return 'Código incorrecto.';
}

/** Crea la cuenta del alta, o encuentra la del correo. Se puede repetir sin duplicar. */
export async function resolverCuenta(p: Pendiente): Promise<{ userId: string | null; clientId: number | null }> {
  const { rows: [u] } = await pool.query(`SELECT id FROM gcc_world.users WHERE LOWER(email) = $1`, [p.correo]);
  let userId: string | null = u?.id ?? null;
  if (!userId && p.alta) {
    const { rows: [n] } = await pool.query(
      `INSERT INTO gcc_world.users (email, password_hash, first_name, role, phone, country, address, is_verified)
       VALUES ($1, $2, $3, 'client', $4, $5, $6, true) RETURNING id`,
      [p.correo, p.alta.hash, p.nombre, p.alta.telefono, p.alta.pais, p.alta.direccion],
    );
    userId = n.id;
    await anotarRegistro('cliente');
  }
  const clientId = userId ? await ensureUserClientAccount(userId) : p.clientId;
  if (p.alta && clientId) {
    await upsertBillingForClient(clientId, {
      id_type: p.alta.idType, ruc: p.alta.identificacion, name: p.nombre, email: p.correo, phone: p.alta.telefono, address: p.alta.direccion,
    } as any);
  }
  return { userId, clientId: clientId ?? null };
}

const usd = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

/** El presupuesto aceptado, como proyecto o ticket abierto y público. */
export async function publicarPresupuesto(
  a: Presupuesto, cuenta: { userId: string | null; clientId: number | null }, correo: string,
): Promise<{ tipo: 'proyecto' | 'ticket'; id: number }> {
  const cliente = await pool.connect();
  let ticket: any = null;
  let id = 0;
  try {
    await cliente.query('BEGIN');
    if (a.tipo === 'proyecto') {
      const { rows: [p] } = await cliente.query(
        `INSERT INTO gcc_world.projects (client_id, client_email, title, description, budget_min, budget_max, status, is_private,
                                         created_by_user_id, open_for_talent, required_talents, source_system)
         VALUES ($1, $2, $3, $4, $5, $6, 'open', false, $7, true, $8::text[], 'presupuestos') RETURNING id`,
        [cuenta.clientId, correo, a.titulo.slice(0, 255), a.descripcion, a.precio_min, a.precio_max, cuenta.userId, a.talentos],
      );
      id = Number(p.id);
      for (const r of a.requerimientos) {
        await cliente.query(
          `INSERT INTO gcc_world.project_requirements (project_id, title, description, talents, slots) VALUES ($1, $2, $3, $4::text[], 1)`,
          [id, r.titulo.slice(0, 255), r.descripcion, a.talentos],
        );
      }
    } else {
      const medio = Math.round((a.precio_min + a.precio_max) / 2);
      const descripcion = `${a.descripcion}\n\nDías de trabajo estimados: ${a.dias}\nRango presupuestado: ${usd(a.precio_min)} a ${usd(a.precio_max)}`;
      const { rows: [t] } = await cliente.query(
        `INSERT INTO gcc_world.tickets (title, description, client_id, estimated_hours, estimated_cost, status, user_id,
                                        open_for_proposals, open_for_talent, required_talents, source_system, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, false, true, $7::text[], 'presupuestos', NOW(), NOW()) RETURNING *`,
        [a.titulo.slice(0, 255), descripcion, cuenta.clientId, (a.dias ?? 0) * 8, medio, cuenta.userId, a.talentos],
      );
      ticket = t;
      id = Number(t.id);
      // Costo 0: el cobro de un ticket suma sus acciones, y aún no hay nada trabajado.
      for (const accion of a.acciones) {
        await cliente.query(
          `INSERT INTO gcc_world.ticket_actions (ticket_id, description, cost, created_by, created_at) VALUES ($1, $2, 0, $3, NOW())`,
          [id, accion, cuenta.userId],
        );
      }
    }
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
  if (ticket) {
    await anunciarTicket(ticket, { mode: 'request', resolvedMemberId: null, resolvedClientEmail: correo, invitePlaceholderEmail: null })
      .catch((e) => console.error('[presupuestos] aviso de ticket', e.message));
  }
  return { tipo: a.tipo, id };
}
