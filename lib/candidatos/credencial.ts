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
  // Vale hasta 7 días después de la APROBACIÓN, que es cuando se borra si no llenó el formulario (`purga.ts`):
  // reenviarla no alarga ese plazo.
  const { rows: [p] } = await pool.query(
    `SELECT decided_at FROM gcc_world.candidate_proposals WHERE LOWER(email) = LOWER($1) AND status = 'approved' ORDER BY id DESC LIMIT 1`, [c.email]);
  const desde = p?.decided_at ? new Date(p.decided_at).getTime() : Date.now();
  const vence = new Date(desde + DIAS_CREDENCIAL * 24 * 3600_000);
  if (vence.getTime() <= Date.now()) throw new Error('Pasaron los 7 días desde la aprobación: el candidato ya no puede completar el alta.');
  const clave = claveTemporal();
  await pool.query(`UPDATE gcc_world.clients SET alta_clave_hash = $2, alta_clave_vence = $3 WHERE id = $1`,
    [c.id, await hashPassword(clave), vence]);
  const primerNombre = nombre || String(c.full_name || c.name || '').split(' ')[0] || '';
  await sendCredencialCandidato({ personal: c.email, correo: c.workspace_email, claveTemporal: clave, nombre: primerNombre, vence });
  return { personal: c.email, corporativo: c.workspace_email };
}
