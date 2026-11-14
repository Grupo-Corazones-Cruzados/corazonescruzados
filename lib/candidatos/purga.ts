import { pool } from '@/lib/db';
import { borrarGrupo } from '@/lib/integrations/google-workspace';

/**
 * ⇒ EL CANDIDATO APROBADO QUE NO LLENA EL FORMULARIO EN 7 DÍAS SE BORRA (Fernando, 2026-11-14): «si el candidato no
 * llena ese formulario en máximo 1 semana de la fecha en que se lo aprobó, se elimina su cuenta y postulación y
 * registros de su postulación en general». Se cuenta desde la APROBACIÓN (`candidate_proposals.decided_at`), no
 * desde el último reenvío de la credencial.
 *
 * Se borra: la dirección corporativa en Google (el grupo), la fila de `clients` (y lo que cuelga de ella en cascada),
 * la postulación, el contacto de correo y, si el formulario quedó a medias, su `users` y su ficha de `members`.
 * Idempotente: lo que ya se borró no se vuelve a encontrar.
 */
export const DIAS_PARA_EL_ALTA = 7;

export async function purgarCandidatosSinAlta(): Promise<{ borrados: string[]; fallidos: string[] }> {
  const { rows } = await pool.query(
    `SELECT c.id, c.email, c.workspace_email, c.user_id, p.id AS propuesta_id
       FROM gcc_world.clients c
       JOIN gcc_world.candidate_proposals p ON LOWER(p.email) = LOWER(c.email) AND p.status = 'approved'
      WHERE c.account_type = 'candidate' AND c.approved = true AND COALESCE(c.profile_completed, false) = false
        AND c.workspace_tipo = 'grupo'
        AND p.decided_at < NOW() - make_interval(days => $1)`,
    [DIAS_PARA_EL_ALTA],
  );
  const borrados: string[] = []; const fallidos: string[] = [];
  for (const c of rows) {
    // Google primero: si falla por algo distinto de «ya no existe», se deja para mañana y no se borra nada.
    try { await borrarGrupo(c.workspace_email); }
    catch (e: any) {
      if (!/not ?found|404|Resource Not Found/i.test(String(e?.message))) { fallidos.push(c.workspace_email); console.error('[candidatos] purga grupo', c.workspace_email, e?.message); continue; }
    }
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      let memberId: number | null = null;
      if (c.user_id) {
        const { rows: [u] } = await db.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [c.user_id]);
        memberId = u?.member_id ?? null;
      }
      await db.query(`DELETE FROM gcc_world.clients WHERE id = $1`, [c.id]);
      await db.query(`DELETE FROM gcc_world.candidate_proposals WHERE LOWER(email) = LOWER($1)`, [c.email]);
      await db.query(`DELETE FROM gcc_world.email_contacts WHERE LOWER(email) = LOWER($1)`, [c.email]).catch(() => {});
      if (c.user_id) await db.query(`DELETE FROM gcc_world.users WHERE id = $1`, [c.user_id]);
      if (memberId) {
        await db.query(`DELETE FROM gcc_world.member_schedules WHERE member_id = $1`, [memberId]);
        await db.query(`DELETE FROM gcc_world.member_cv_profiles WHERE member_id = $1`, [memberId]);
        await db.query(`DELETE FROM gcc_world.members WHERE id = $1`, [memberId]);
      }
      await db.query('COMMIT');
      borrados.push(c.workspace_email);
    } catch (e: any) {
      await db.query('ROLLBACK').catch(() => {});
      fallidos.push(c.workspace_email);
      console.error('[candidatos] purga', c.workspace_email, e?.message);
    } finally { db.release(); }
  }
  if (borrados.length) console.log(`[candidatos] purga: ${borrados.length} candidato(s) sin alta borrados: ${borrados.join(', ')}`);
  return { borrados, fallidos };
}
