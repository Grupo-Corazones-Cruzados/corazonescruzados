import { randomBytes } from 'crypto';
import { pool } from '@/lib/db';

/**
 * Enlace público de una LISTA DE CONTACTOS (Automatizaciones → Email masivo).
 *
 * El token es la ÚNICA credencial de la página pública, así que toda la validación
 * vive aquí y los endpoints públicos no tocan la BD por su cuenta:
 *   - `resolveShareToken` es el único camino de token → lista (y valida el tipo de flujo).
 *   - Los límites (tamaño de la lista, formato del correo, longitud de los campos) se
 *     aplican en `validateContactInput` / `assertRoomInList`, no en la UI: la página
 *     pública es cliente y no se puede confiar en ella.
 *
 * Quien tenga el enlace puede VER, AGREGAR, EDITAR y QUITAR contactos de esa lista —
 * eso es lo que se pidió— pero nada más: no llega al flujo, ni a otras listas, ni a
 * las campañas.
 */

/** Tope de contactos por lista abierta al público (freno a un abuso del enlace). */
export const MAX_CONTACTS_PER_SHARED_LIST = 2000;
const MAX_NAME_LEN = 120;
const MAX_EMAIL_LEN = 180;
const MAX_POSITION_LEN = 160;
const MAX_PHONE_LEN = 30;   // el ancho de la columna `phone`

/** Flujos cuyas listas se pueden compartir. Hoy solo email masivo (se pide correo). */
const SHAREABLE_FLOW_TYPES = new Set(['email']);

export interface SharedList {
  id: number;
  name: string;
  flowId: number;
  flowType: string;
  flowName: string;
  shareCreatedAt: string | null;
}

export class ShareError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

/** Token opaco de 32 bytes en base64url (43 caracteres, no adivinable). */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Token → lista. Devuelve `null` si el token no existe o ya se revocó, para que la
 * página pública muestre "enlace inválido" sin distinguir entre ambos casos.
 */
export async function resolveShareToken(token: string): Promise<SharedList | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const { rows: [row] } = await pool.query(
    `SELECT cl.id, cl.name, cl.share_created_at, f.id AS flow_id, f.type AS flow_type, f.name AS flow_name
       FROM gcc_world.flow_contact_lists cl
       JOIN gcc_world.flows f ON f.id = cl.flow_id
      WHERE cl.share_token = $1`,
    [token],
  );
  if (!row) return null;
  if (!SHAREABLE_FLOW_TYPES.has(row.flow_type)) return null;
  return {
    id: Number(row.id),
    name: row.name,
    flowId: Number(row.flow_id),
    flowType: row.flow_type,
    flowName: row.flow_name,
    shareCreatedAt: row.share_created_at ? new Date(row.share_created_at).toISOString() : null,
  };
}

/** Genera (o regenera) el token de una lista y devuelve el nuevo. */
export async function createShareToken(flowId: string | number, listId: string | number): Promise<string> {
  const { rows: [flow] } = await pool.query(`SELECT type FROM gcc_world.flows WHERE id = $1`, [flowId]);
  if (!flow) throw new ShareError('El flujo no existe', 404);
  if (!SHAREABLE_FLOW_TYPES.has(flow.type)) {
    throw new ShareError('Solo las listas de un flujo de email masivo se pueden compartir', 400);
  }
  const token = generateShareToken();
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.flow_contact_lists
        SET share_token = $1, share_created_at = NOW()
      WHERE id = $2 AND flow_id = $3`,
    [token, listId, flowId],
  );
  if (!rowCount) throw new ShareError('La lista no existe', 404);
  return token;
}

/** Revoca el enlace: el token deja de servir, la lista y sus contactos no se tocan. */
export async function revokeShareToken(flowId: string | number, listId: string | number): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.flow_contact_lists
        SET share_token = NULL, share_created_at = NULL
      WHERE id = $1 AND flow_id = $2`,
    [listId, flowId],
  );
}

/** URL absoluta del enlace público. */
export function shareUrl(token: string, origin?: string): string {
  const base = (origin || process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org').replace(/\/+$/, '');
  return `${base}/lista-contactos/${token}`;
}

/** Correo con forma válida (sin pretender validar que exista). */
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * Normaliza y valida lo que manda la página pública. Lanza `ShareError` si no sirve.
 *
 * Los CUATRO campos son obligatorios (decisión del usuario, 2026-07-30): son justo los que
 * alimentan las variables del correo (`{{nombre}}` `{{correo}}` `{{telefono}}` `{{puesto}}`),
 * y si quien llena la lista se deja uno vacío, ese hueco aparece en el correo enviado.
 */
export function validateContactInput(raw: any): { name: string; email: string; phone: string; position: string } {
  const name = String(raw?.name ?? '').trim().replace(/\s+/g, ' ');
  const email = String(raw?.email ?? '').trim().toLowerCase();
  const phone = String(raw?.phone ?? '').trim().replace(/\s+/g, ' ');
  const position = String(raw?.position ?? '').trim().replace(/\s+/g, ' ');

  if (!name) throw new ShareError('El nombre es requerido');
  if (name.length > MAX_NAME_LEN) throw new ShareError(`El nombre no puede pasar de ${MAX_NAME_LEN} caracteres`);

  if (!email) throw new ShareError('El correo es requerido');
  if (email.length > MAX_EMAIL_LEN) throw new ShareError(`El correo no puede pasar de ${MAX_EMAIL_LEN} caracteres`);
  if (!isEmail(email)) throw new ShareError('El correo no tiene un formato válido');

  if (!position) throw new ShareError('El puesto es requerido');
  if (position.length > MAX_POSITION_LEN) throw new ShareError(`El puesto no puede pasar de ${MAX_POSITION_LEN} caracteres`);

  if (!phone) throw new ShareError('El teléfono es requerido');
  if (phone.length > MAX_PHONE_LEN) throw new ShareError(`El teléfono no puede pasar de ${MAX_PHONE_LEN} caracteres`);
  // Se acepta cualquier formato razonable (con o sin prefijo, con espacios o guiones), pero
  // tiene que tener dígitos suficientes para ser un teléfono.
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) throw new ShareError('El teléfono no parece válido');

  return { name, email, phone, position };
}

/** Frena el crecimiento de una lista abierta al público. */
export async function assertRoomInList(listId: number): Promise<void> {
  const { rows: [{ n }] } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM gcc_world.flow_contacts WHERE list_id = $1`, [listId],
  );
  if (n >= MAX_CONTACTS_PER_SHARED_LIST) {
    throw new ShareError(`Esta lista alcanzó el máximo de ${MAX_CONTACTS_PER_SHARED_LIST} contactos`, 409);
  }
}

/** Contactos de la lista, tal como los ve la página pública. */
export async function listSharedContacts(listId: number) {
  const { rows } = await pool.query(
    `SELECT id, name, email, phone, position, added_via_share, created_at
       FROM gcc_world.flow_contacts
      WHERE list_id = $1
      ORDER BY created_at DESC, id DESC`,
    [listId],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    name: r.name,
    email: r.email || '',
    phone: r.phone || '',
    position: r.position || '',
    addedViaShare: !!r.added_via_share,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  }));
}

/** Correo ya presente en la lista (evita duplicados en el mismo envío). */
export async function emailExistsInList(listId: number, email: string, exceptId?: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.flow_contacts
      WHERE list_id = $1 AND LOWER(email) = $2 AND ($3::int IS NULL OR id <> $3::int)
      LIMIT 1`,
    [listId, email, exceptId ?? null],
  );
  return rows.length > 0;
}
