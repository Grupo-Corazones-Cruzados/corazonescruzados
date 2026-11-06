import { pool } from '@/lib/db';
import { marcarRegistrosFacturados } from '@/lib/tickets/facturacion';

type Consulta = { query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

export type OrigenRefacturado = { tipo: 'ticket' | 'project'; id: string; titulo: string; completado: boolean };

/**
 * LA FACTURA NUEVA OCUPA EL LUGAR DE LA ANULADA (Fernando, 2026-11-05: revisar los errores de la refactura).
 *
 * Todo se lee de la factura anulada, no de lo que mande la pantalla. Una factura de etapa guarda su proyecto en
 * `invoice_projects`, con `project_id` vacío, así que la pantalla no le veía origen y la refactura quedaba
 * huérfana: sin ingreso, sin proyecto y con la etapa abierta para cobrarse otra vez. Le pasó al proyecto 37.
 *
 * Hereda sus etapas, requerimientos y proyectos. Un origen solo vuelve a «completado» si no le queda ninguna
 * etapa abierta: refacturar la primera de dos no termina un proyecto en curso. El origen se apunta en el
 * registro de ingresos porque cada factura lleva el suyo: sin eso, el relleno sumaría además el costo entero.
 *
 * El ingreso de la factura nueva lo registra quien llama, tras confirmar este trabajo.
 */
export async function heredarDeFacturaAnulada(
  anuladaId: number | string,
  nuevaId: number | string,
  db: Consulta = pool,
): Promise<OrigenRefacturado[]> {
  const { rows: [vieja] } = await db.query(
    `SELECT id, source_type, source_id, ticket_id, project_id, origen_estado_previo
       FROM gcc_world.invoices WHERE id = ($1)::int AND status = 'cancelled'`,
    [anuladaId],
  );
  if (!vieja) return [];

  const { rows: etapas } = await db.query(
    `UPDATE gcc_world.project_stages SET invoice_id = ($2)::int, updated_at = NOW()
      WHERE invoice_id = ($1)::int RETURNING project_id, ticket_id`,
    [anuladaId, nuevaId],
  );
  await db.query(
    `INSERT INTO gcc_world.invoice_requirements (invoice_id, requirement_id, project_id)
     SELECT ($2)::int, requirement_id, project_id FROM gcc_world.invoice_requirements WHERE invoice_id = ($1)::int
     ON CONFLICT DO NOTHING`,
    [anuladaId, nuevaId],
  );
  const { rows: enlaces } = await db.query(
    `SELECT project_id FROM gcc_world.invoice_projects WHERE invoice_id = ($1)::int`, [anuladaId],
  );
  await db.query(
    `INSERT INTO gcc_world.invoice_projects (invoice_id, project_id)
     SELECT ($2)::int, project_id FROM gcc_world.invoice_projects WHERE invoice_id = ($1)::int`,
    [anuladaId, nuevaId],
  );

  const tickets = new Set<string>();
  if (vieja.source_type === 'ticket' && vieja.source_id != null) tickets.add(String(vieja.source_id));
  if (vieja.ticket_id != null) tickets.add(String(vieja.ticket_id));
  for (const e of etapas) if (e.ticket_id != null) tickets.add(String(e.ticket_id));

  const proyectos = new Set<string>();
  if (vieja.project_id != null) proyectos.add(String(vieja.project_id));
  for (const e of enlaces) if (e.project_id != null) proyectos.add(String(e.project_id));
  for (const e of etapas) if (e.project_id != null) proyectos.add(String(e.project_id));

  const salida: OrigenRefacturado[] = [];
  const estadoPrevio = vieja.origen_estado_previo || null;

  for (const id of tickets) {
    await db.query(
      `UPDATE gcc_world.invoices SET source_type = 'ticket', source_id = ($2)::text, ticket_id = (($2)::text)::int WHERE id = ($1)::int`,
      [nuevaId, id],
    );
    await marcarRegistrosFacturados(id, Number(nuevaId), null, db);
    const r = await completarSiNoQuedanEtapas('tickets', 'ticket_id', id, db);
    if (r.completado && estadoPrevio) await db.query(`UPDATE gcc_world.invoices SET origen_estado_previo = $2 WHERE id = ($1)::int`, [nuevaId, estadoPrevio]);
    await apuntarOrigen('ticket', id, db);
    salida.push({ tipo: 'ticket', id, titulo: r.titulo, completado: r.completado });
  }
  for (const id of proyectos) {
    if (vieja.project_id != null && String(vieja.project_id) === id) {
      await db.query(`UPDATE gcc_world.invoices SET project_id = ($2)::bigint WHERE id = ($1)::int`, [nuevaId, id]);
    }
    const r = await completarSiNoQuedanEtapas('projects', 'project_id', id, db);
    if (r.completado && estadoPrevio) await db.query(`UPDATE gcc_world.invoices SET origen_estado_previo = $2 WHERE id = ($1)::int`, [nuevaId, estadoPrevio]);
    await apuntarOrigen('project', id, db);
    salida.push({ tipo: 'project', id, titulo: r.titulo, completado: r.completado });
  }
  return salida;
}

async function completarSiNoQuedanEtapas(tabla: 'tickets' | 'projects', columna: 'ticket_id' | 'project_id', id: string, db: Consulta) {
  const { rows: [abiertas] } = await db.query(
    `SELECT EXISTS (SELECT 1 FROM gcc_world.project_stages ps
       LEFT JOIN gcc_world.invoices i ON i.id = ps.invoice_id AND i.status <> 'cancelled'
      WHERE ps.${columna} = ($1)::bigint AND i.id IS NULL) AS hay`,
    [id],
  );
  const { rows: [origen] } = abiertas.hay
    ? await db.query(`SELECT title FROM gcc_world.${tabla} WHERE id = ($1)::bigint`, [id])
    : await db.query(`UPDATE gcc_world.${tabla} SET status = 'completed', updated_at = NOW() WHERE id = ($1)::bigint RETURNING title`, [id]);
  return { titulo: origen?.title || '', completado: !abiertas.hay && !!origen };
}

function apuntarOrigen(tipo: string, id: string, db: Consulta) {
  return db.query(
    `INSERT INTO gcc_world.finance_source_log (source_type, source_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [tipo, id],
  );
}
