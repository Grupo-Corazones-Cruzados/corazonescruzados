import { pool } from '@/lib/db';

/**
 * TALENTOS DEMOSTRADOS — la única cuenta de talentos que decide algo (Fernando, 2026-11-09).
 *
 * «Solo cuentan los demostrados: puntos ganados con tareas o actividades cumplidas. Lo declarado
 * en el CV es una premisa que se valida en el trabajo. Al perfil se asocian los 5 primeros, también
 * en candidatos, y con ellos es elegible: ve lo publicado de su talento, oferta y aparece en los
 * selectores.» (MEMORIA.md › «EL MODELO ECONÓMICO DE LA PLATAFORMA»).
 *
 * Antes había tres fuentes sin relación: el CV declarado, `services.talent` (con el que se tomaba
 * un ticket) y los puntos de tareas del Centralizado. Ahora hay UNA cuenta, en UNA consulta, y la
 * usan el perfil (`getSubjectsProfileScores`), los selectores de personas, las listas de tickets y
 * proyectos publicados y las rutas que invitan, asignan o dejan tomar.
 *
 * ── DE DÓNDE SALEN LOS PUNTOS (por talento) ─────────────────────────────────────────────────────
 *   Tareas (las tres fuentes del Centralizado: Horario de Vida, tareas generadas por Comandos
 *   Violeta y tareas de eventos de Gestión Social), por cada talento etiquetado:
 *     · cumplida  `completed` → +1
 *     · fallida   `failed`    → −1          (pendiente no puntúa)
 *   Trabajo entregado, por cada talento que pedía:
 *     · TICKET completado → +1 a su responsable (`tickets.member_id`).
 *     · REQUERIMIENTO hecho (`completed_at`, o su proyecto completado) → +1 a cada miembro con
 *       asignación ACEPTADA. Si nadie tenía asignación aceptada, lo hizo el responsable del
 *       proyecto (`assigned_member_id`): es como trabaja hoy Fernando, que atiende solo sus
 *       proyectos. Un requerimiento cuenta una vez por persona aunque tenga filas repetidas.
 *       Cuenta aunque el proyecto se cancelara después: el trabajo se hizo y se dio por hecho.
 *     · PROYECTO completado → +1 a su responsable por cada `projects.required_talents`.
 *   Un ticket o proyecto CANCELADO no resta: la cancelación puede ser del cliente.
 *
 *   No cuentan: lo declarado en el CV, los servicios (`services.talent`), la valoración manual de
 *   Gestión Social (es una nota fija de una persona, no un cumplimiento) ni las ventas de
 *   productos — los pedidos (`orders`/`order_items`) nunca pasan de `pending` y no hay señal de
 *   entrega, y las suscripciones no se enlazan con el producto ofrecido.
 *
 * ── QUIÉN ES «LA PERSONA» ───────────────────────────────────────────────────────────────────────
 *   Las tareas se apuntan a un sujeto (`member` = members.id, o `candidate` = clients.id) y el
 *   trabajo a una ficha de miembro. Una misma persona puede tener los dos (un candidato recibe
 *   ficha de miembro inactiva al entrar, ver `ensureAdminMember`): se suman, sin contar nada dos
 *   veces. Así un candidato que se convierte en miembro no pierde lo que demostró.
 *
 * Los pesos están en `PUNTOS` y en la consulta como literales; si se cambian, cambiar ambos.
 */

export const PUNTOS = {
  tareaCumplida: 1,
  tareaFallida: -1,
  ticketCompletado: 1,
  requerimientoHecho: 1,
  proyectoCompletado: 1,
} as const;

/** Cuántos talentos demostrados forman el perfil y deciden la elegibilidad. */
export const TOP_TALENTOS = 5;

export interface TalentoDemostrado { name: string; points: number }

/* El esquema que lee la consulta: una vez por proceso (nunca DDL por petición en una lista). */
let preparado: Promise<void> | null = null;
function prepararEsquema(): Promise<void> {
  const enCurso = preparado ?? (async () => {
    // Import dinámico: horario-db usa este módulo para el perfil; así no hay ciclo al cargar.
    const [{ ensureHorarioTables }, { ensureGeneratedTasksTable }, { ensureGestionSocialTables }, { ensureRequirementColumns }] =
      await Promise.all([
        import('@/lib/centralized/horario-db'),
        import('@/lib/centralized/comandos-db'),
        import('@/lib/centralized/gestion-social-db'),
        import('@/lib/projects/requirements'),
      ]);
    await ensureHorarioTables();
    await ensureGeneratedTasksTable();
    await ensureGestionSocialTables();
    await ensureRequirementColumns();
    await pool.query(`
      ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS required_talents TEXT[] DEFAULT '{}';
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS required_talents TEXT[] DEFAULT '{}';
    `);
  })().catch((e) => { preparado = null; throw e; });
  preparado = enCurso;
  return enCurso;
}

/**
 * LA CONSULTA. Recibe fichas de miembro ($1) y fichas de candidato ($2) y devuelve, por persona
 * (`k` = 'm<id>' o 'c<id>'), sus talentos con puntos netos POSITIVOS. Una sola ida a la base
 * para cualquier número de personas.
 */
const SQL_PUNTOS = `
WITH personas AS (
  SELECT 'm' || x.id AS k, x.id AS member_id, c.id AS client_id
    FROM unnest($1::bigint[]) AS x(id)
    LEFT JOIN gcc_world.users u ON u.member_id = x.id
    LEFT JOIN gcc_world.clients c ON c.user_id = u.id AND c.account_type = 'candidate'
  UNION ALL
  SELECT 'c' || x.id, u.member_id, c.id
    FROM unnest($2::bigint[]) AS x(id)
    JOIN gcc_world.clients c ON c.id = x.id
    LEFT JOIN gcc_world.users u ON u.id = c.user_id
),
sujetos AS (
  SELECT DISTINCT k, 'member'::text AS kind, member_id::text AS sid FROM personas WHERE member_id IS NOT NULL
  UNION
  SELECT DISTINCT k, 'candidate'::text, client_id::text FROM personas WHERE client_id IS NOT NULL
),
trabajadores AS (SELECT DISTINCT k, member_id FROM personas WHERE member_id IS NOT NULL),
eventos AS (
  SELECT s.k, t.talento, CASE WHEN h.status = 'completed' THEN 1 ELSE -1 END AS pts
    FROM sujetos s
    JOIN gcc_world.hv_schedule h ON h.subject_kind = s.kind AND h.subject_id = s.sid AND h.status IN ('completed','failed')
    JOIN gcc_world.hv_task_labels l ON l.alternative_id = h.alternative_id
    CROSS JOIN LATERAL unnest(l.talent_tags) AS t(talento)
  UNION ALL
  SELECT s.k, t.talento, CASE WHEN g.status = 'completed' THEN 1 ELSE -1 END
    FROM sujetos s
    JOIN gcc_world.cv_generated_tasks g ON g.subject_kind = s.kind AND g.subject_id = s.sid AND g.status IN ('completed','failed')
    CROSS JOIN LATERAL unnest(g.talent_tags) AS t(talento)
  UNION ALL
  SELECT s.k, t.talento, CASE WHEN su.status = 'completed' THEN 1 ELSE -1 END
    FROM sujetos s
    JOIN gcc_world.gs_task_signups su ON su.subject_kind = s.kind AND su.subject_id = s.sid AND su.status IN ('completed','failed')
    JOIN gcc_world.gs_event_tasks et ON et.id = su.task_id
    CROSS JOIN LATERAL unnest(et.talent_tags) AS t(talento)
  UNION ALL
  SELECT w.k, t.talento, 1
    FROM trabajadores w
    JOIN gcc_world.tickets tk ON tk.member_id = w.member_id AND tk.status = 'completed'
    CROSS JOIN LATERAL unnest(COALESCE(tk.required_talents, '{}')) AS t(talento)
  UNION ALL
  SELECT hecho.k, t.talento, 1
    FROM (
      SELECT DISTINCT w.k, r.id, r.talents
        FROM gcc_world.project_requirements r
        JOIN gcc_world.projects p ON p.id = r.project_id
        JOIN trabajadores w ON (
              EXISTS (SELECT 1 FROM gcc_world.requirement_assignments ra
                       WHERE ra.requirement_id = r.id AND ra.member_id = w.member_id AND ra.status = 'accepted')
           OR (p.assigned_member_id = w.member_id
               AND NOT EXISTS (SELECT 1 FROM gcc_world.requirement_assignments ra
                                WHERE ra.requirement_id = r.id AND ra.status = 'accepted')))
       WHERE r.completed_at IS NOT NULL OR p.status = 'completed'
    ) hecho
    CROSS JOIN LATERAL unnest(COALESCE(hecho.talents, '{}')) AS t(talento)
  UNION ALL
  SELECT w.k, t.talento, 1
    FROM trabajadores w
    JOIN gcc_world.projects p ON p.assigned_member_id = w.member_id AND p.status = 'completed'
    CROSS JOIN LATERAL unnest(COALESCE(p.required_talents, '{}')) AS t(talento)
)
SELECT k, talento, SUM(pts)::int AS puntos
  FROM eventos
 GROUP BY k, talento
HAVING SUM(pts) > 0
 ORDER BY k, puntos DESC, talento`;

const ids = (xs: (string | number | null | undefined)[] | undefined) =>
  [...new Set((xs || []).map((x) => String(x ?? '').trim()).filter((x) => /^\d+$/.test(x)))];

/**
 * Puntos por talento (solo netos positivos, de mayor a menor) de fichas de miembro y de
 * candidato, en una sola consulta.
 */
export async function puntosDeTalento(opts: { miembros?: (string | number | null)[]; candidatos?: (string | number | null)[] }): Promise<{
  miembros: Map<string, TalentoDemostrado[]>;
  candidatos: Map<string, TalentoDemostrado[]>;
}> {
  const m = ids(opts.miembros);
  const c = ids(opts.candidatos);
  const out = { miembros: new Map<string, TalentoDemostrado[]>(), candidatos: new Map<string, TalentoDemostrado[]>() };
  if (!m.length && !c.length) return out;
  await prepararEsquema();
  const { rows } = await pool.query(SQL_PUNTOS, [m, c]);
  for (const r of rows) {
    const k = String(r.k);
    const destino = k[0] === 'm' ? out.miembros : out.candidatos;
    const id = k.slice(1);
    const lista = destino.get(id) || [];
    lista.push({ name: String(r.talento), points: Number(r.puntos) });
    destino.set(id, lista);
  }
  return out;
}

/** Los 5 primeros nombres (la lista ya viene ordenada por puntos y, a igualdad, por nombre). */
export function top5(lista: TalentoDemostrado[] | undefined | null): string[] {
  return (lista || []).slice(0, TOP_TALENTOS).map((t) => t.name);
}

/** Top 5 demostrado de varias fichas de miembro (selectores): una consulta para todas. */
export async function top5DeMiembros(memberIds: (string | number | null)[]): Promise<Map<string, string[]>> {
  const { miembros } = await puntosDeTalento({ miembros: memberIds });
  const out = new Map<string, string[]>();
  for (const id of ids(memberIds)) out.set(id, top5(miembros.get(id)));
  return out;
}

/** Top 5 demostrado de UNA ficha de miembro. Sin ficha → []. */
export async function top5DeMiembro(memberId: string | number | null | undefined): Promise<string[]> {
  if (memberId == null || memberId === '') return [];
  return (await top5DeMiembros([memberId])).get(String(memberId)) || [];
}

/**
 * La ficha de miembro de un usuario y su top 5. Es lo que necesitan las listas para decidir qué
 * publicado le enseñan: una consulta para la ficha y otra para los puntos.
 */
export async function misTalentos(userId: string): Promise<{ memberId: number | null; top5: string[] }> {
  const memberId = await fichaDeMiembro(userId);
  return { memberId, top5: memberId != null ? await top5DeMiembro(memberId) : [] };
}

/** La ficha de miembro (`users.member_id`) de un usuario, o null. */
export async function fichaDeMiembro(userId: string): Promise<number | null> {
  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
  return u?.member_id != null ? Number(u.member_id) : null;
}

/** ¿Alguno de los talentos pedidos está en su top 5? Sin talentos pedidos no hay nada que exigir. */
export function encaja(top: string[], pedidos: string[] | null | undefined): boolean {
  const req = (pedidos || []).filter(Boolean);
  if (!req.length) return true;
  return req.some((t) => top.includes(t));
}

/**
 * Los talentos que «pide» un proyecto a quien no está en él: los de `projects.required_talents`
 * más los de sus requerimientos que aún tienen plazas libres (sin terminar y con menos
 * asignaciones aceptadas que plazas). Expresión SQL `text[]` sobre el alias del proyecto.
 */
export function talentosAbiertosProyectoSql(alias: string): string {
  return `(COALESCE(${alias}.required_talents, '{}'::text[]) || COALESCE((
    SELECT array_agg(DISTINCT t)
      FROM gcc_world.project_requirements r, unnest(r.talents) AS t
     WHERE r.project_id = ${alias}.id
       AND r.completed_at IS NULL
       AND (SELECT COUNT(*) FROM gcc_world.requirement_assignments ra
             WHERE ra.requirement_id = r.id AND ra.status = 'accepted') < GREATEST(COALESCE(r.slots, 1), 1)
  ), '{}'::text[]))`;
}

/**
 * ¿Un proyecto PUBLICADO se le enseña a quien tiene estos talentos? Público (no privado, ni
 * borrador, ni cotización) y, o pide alguno de ellos (`talentosAbiertosProyectoSql`), o no pide
 * ningún talento en absoluto (ni el proyecto ni sus requerimientos: no hay nada que exigir). Un
 * proyecto con todos sus requerimientos cubiertos ya no pide nada y no se enseña a quien no
 * está en él. `talentos` es SQL (un parámetro `text[]`).
 */
export function proyectoPublicadoParaSql(alias: string, talentos: string): string {
  return `(${alias}.is_private = false AND ${alias}.status NOT IN ('draft','cotizacion') AND (
    ${talentosAbiertosProyectoSql(alias)} && ${talentos}
    OR (cardinality(COALESCE(${alias}.required_talents, '{}'::text[])) = 0
        AND NOT EXISTS (SELECT 1 FROM gcc_world.project_requirements r0
                         WHERE r0.project_id = ${alias}.id AND cardinality(r0.talents) > 0))
  ))`;
}

/** Los talentos que pide un proyecto (misma regla que `talentosAbiertosProyectoSql`). */
export async function talentosAbiertosDelProyecto(projectId: string | number): Promise<string[]> {
  await prepararEsquema();
  const { rows: [p] } = await pool.query(
    `SELECT ${talentosAbiertosProyectoSql('p')} AS t FROM gcc_world.projects p WHERE p.id = ($1)::bigint`,
    [String(projectId)],
  );
  return [...new Set<string>((p?.t || []).filter(Boolean))];
}

/** Los talentos de un requerimiento concreto. */
export async function talentosDelRequerimiento(requirementId: string | number): Promise<string[]> {
  const { rows: [r] } = await pool.query(
    `SELECT talents FROM gcc_world.project_requirements WHERE id = ($1)::bigint`, [String(requirementId)],
  );
  return (r?.talents || []).filter(Boolean);
}

/**
 * Comprobación de servidor para invitar, asignar, tomar, sumar participante o elegir
 * responsable: devuelve `null` si vale, o el mensaje de error. Sin talentos pedidos, vale.
 */
export async function validarTalento(memberId: string | number | null | undefined, pedidos: string[]): Promise<string | null> {
  if (!pedidos.filter(Boolean).length) return null;
  if (memberId == null || memberId === '') return 'Esa persona no tiene perfil para este trabajo.';
  const top = await top5DeMiembro(memberId);
  return encaja(top, pedidos)
    ? null
    : 'Esa persona no tiene demostrado ninguno de los talentos que pide este trabajo (cuentan sus 5 primeros).';
}
