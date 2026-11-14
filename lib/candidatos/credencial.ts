import { randomInt } from 'crypto';
import { pool } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { sendCredencialCandidato } from '@/lib/integrations/email';

/**
 * ⇒ LA CREDENCIAL DEL CANDIDATO APROBADO (Fernando, 2026-11-14). Una contraseña temporal NUEVA (se guarda solo su
 * hash, así que no se puede «volver a mandar la misma»), válida 7 días, y el correo a su CORREO PERSONAL: el que va
 * solo al corporativo dependía del reenvío del grupo de Google y la primera aprobación real no llegó a Outlook.
 * La usan la aprobación y el botón «Reenviar credencial».
 */
export function claveTemporal(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 10 }, () => letras[randomInt(letras.length)]).join('');
}

export const DIAS_CREDENCIAL = 7;

/** Genera la credencial del candidato `clientId`, la guarda y la envía. Devuelve a dónde fue. */
export async function emitirCredencialAlta(clientId: number | string, nombre?: string | null): Promise<{ personal: string; corporativo: string }> {
  const { rows: [c] } = await pool.query(
    `SELECT id, email, workspace_email, workspace_tipo, profile_completed, full_name, name FROM gcc_world.clients WHERE id = $1`,
    [clientId],
  );
  if (!c || c.workspace_tipo !== 'grupo' || !c.workspace_email) throw new Error('Este candidato no tiene correo corporativo.');
  if (c.profile_completed) throw new Error('Este candidato ya creó su cuenta.');
  const clave = claveTemporal();
  const vence = new Date(Date.now() + DIAS_CREDENCIAL * 24 * 3600_000);
  await pool.query(`UPDATE gcc_world.clients SET alta_clave_hash = $2, alta_clave_vence = $3 WHERE id = $1`,
    [c.id, await hashPassword(clave), vence]);
  const primerNombre = nombre || String(c.full_name || c.name || '').split(' ')[0] || '';
  await sendCredencialCandidato({ personal: c.email, correo: c.workspace_email, claveTemporal: clave, nombre: primerNombre, vence });
  return { personal: c.email, corporativo: c.workspace_email };
}
