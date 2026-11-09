/**
 * ⭐ LO QUE ES DE UN MIEMBRO — definición ÚNICA en SQL (Fernando, 2026-11-09: «los miembros no deberían ver
 * los clientes de otros usuarios, ni las facturas de otros usuarios, y el dashboard debe ser solo de lo que
 * le pertenece al usuario»). La usan los contadores del Inicio, Clientes y Facturas.
 *
 * Cada función devuelve una condición sobre el alias que recibe. `u` y `m` son los marcadores de los
 * parámetros (p. ej. `'$1'`, `'$2'`): el id del usuario de la sesión (uuid) y su ficha de miembro
 * (`users.member_id`, puede ser NULL). Los tipos van siempre con su conversión explícita, para que un mismo
 * parámetro no se deduzca con dos tipos.
 *
 * El administrador no pasa por aquí: es el dueño de la organización y ve todo en estas listas.
 * La pertenencia tiene varios caminos y se resuelven todos en la misma consulta (ver
 * `gcc-hay-sesion-no-es-tuyo`).
 */
import { pool } from '@/lib/db';
import { miembroDe, miembroEnProyectoSql } from '@/lib/projects/permisos';
import { SQL_RUCS_DEL_CLIENTE } from '@/lib/billing-clients';

// ⚠️ Los alias de las subconsultas no pueden ser `pm`, `pb`, `ra` ni `pr`: son los de `miembroEnProyectoSql`,
// y uno repetido haría que su condición mirase la tabla equivocada sin dar ningún error.

const conMiembro = (m: string, cond: string) => `(${m}::bigint IS NOT NULL AND ${cond})`;

/** Ticket mío: lo creé yo o soy su responsable. */
export const sqlTicketMio = (t: string, u: string, m: string) =>
  `(${t}.user_id = ${u}::uuid OR ${conMiembro(m, `${t}.member_id = ${m}::bigint`)})`;

/** Proyecto mío: lo creé yo, o estoy en él (responsable, equipo, puja o requerimiento aceptados). */
export const sqlProyectoMio = (p: string, u: string, m: string) =>
  `(${p}.created_by_user_id = ${u}::text OR ${conMiembro(m, miembroEnProyectoSql(p, `${m}::bigint`))})`;

/**
 * Factura mía: la de un ticket o proyecto mío, por TODOS los caminos por los que una factura cuelga de
 * ellos —las columnas `ticket_id`/`project_id`, el origen `source_type`/`source_id`, `invoice_projects` y
 * las etapas (`project_stages.invoice_id`)—, o la que lleva mi ficha en `invoices.member_id`. Una
 * suscripción o una factura manual sin nada de eso no es de ningún miembro: solo la ve el administrador.
 */
export const sqlFacturaMia = (i: string, u: string, m: string) => `(
  ${conMiembro(m, `${i}.member_id = ${m}::bigint`)}
  OR EXISTS (SELECT 1 FROM gcc_world.tickets tm
              WHERE (tm.id = ${i}.ticket_id OR (${i}.source_type = 'ticket' AND ${i}.source_id = tm.id::text))
                AND ${sqlTicketMio('tm', u, m)})
  OR EXISTS (SELECT 1 FROM gcc_world.projects pfm
              WHERE (pfm.id = ${i}.project_id
                     OR (${i}.source_type = 'project' AND ${i}.source_id = pfm.id::text)
                     OR EXISTS (SELECT 1 FROM gcc_world.invoice_projects ipm
                                 WHERE ipm.invoice_id = ${i}.id AND ipm.project_id = pfm.id::text))
                AND ${sqlProyectoMio('pfm', u, m)})
  OR EXISTS (SELECT 1 FROM gcc_world.project_stages psm
              WHERE psm.invoice_id = ${i}.id
                AND (EXISTS (SELECT 1 FROM gcc_world.tickets tsm WHERE tsm.id = psm.ticket_id AND ${sqlTicketMio('tsm', u, m)})
                     OR EXISTS (SELECT 1 FROM gcc_world.projects psp WHERE psp.id = psm.project_id AND ${sqlProyectoMio('psp', u, m)}))))`;

/**
 * Cliente (del portal, `gcc_world.clients`) mío: lo creé yo (`created_by_member_id`) o tiene un ticket o
 * proyecto mío. Es la regla del selector `/api/clients?mine=1`.
 */
export const sqlClienteMio = (c: string, u: string, m: string) => `(
  ${conMiembro(m, `${c}.created_by_member_id = ${m}::bigint`)}
  OR EXISTS (SELECT 1 FROM gcc_world.tickets tc WHERE tc.client_id = ${c}.id AND ${sqlTicketMio('tc', u, m)})
  OR EXISTS (SELECT 1 FROM gcc_world.projects pc WHERE pc.client_id = ${c}.id AND ${sqlProyectoMio('pc', u, m)}))`;

/**
 * Cliente de facturación (`billing_clients`, la fila TITULAR `bc`) mío: su cliente del portal es mío, o su
 * identificación (o un alias, o la de uno de sus datos extra) está en una factura mía.
 */
export const sqlClienteFacturacionMio = (bc: string, u: string, m: string) => `(
  EXISTS (SELECT 1 FROM gcc_world.clients cbm WHERE cbm.id = ${bc}.portal_client_id AND ${sqlClienteMio('cbm', u, m)})
  OR EXISTS (SELECT 1 FROM gcc_world.invoices ibm
              WHERE ${SQL_RUCS_DEL_CLIENTE(bc, 'ibm')}
                AND ${sqlFacturaMia('ibm', u, m)}))`;

/**
 * ¿Puede ver y tocar este cliente de facturación quien tiene la sesión? `id` puede ser el titular o uno de
 * sus datos extra: decide el titular. El administrador, siempre; un miembro, si es suyo
 * (`sqlClienteFacturacionMio`); nadie más (las rutas de Clientes ya cierran el paso a los demás roles).
 */
export async function clienteFacturacionEsMio(user: { userId: string; role: string }, id: number | string): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.role !== 'member' || !/^\d{1,9}$/.test(String(id))) return false;
  const yo = await miembroDe(user.userId);
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.billing_clients b
       JOIN gcc_world.billing_clients t ON t.id = COALESCE(b.titular_id, b.id)
      WHERE b.id = $1 AND ${sqlClienteFacturacionMio('t', '$2', '$3')} LIMIT 1`,
    [Number(id), user.userId, yo],
  );
  return rows.length > 0;
}
