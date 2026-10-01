import { pool } from '@/lib/db';
import { AVAILABILITY, type AvailabilityStatus } from '@/lib/calendar/availability';

type PoolClient = Awaited<ReturnType<typeof pool.connect>>;

/**
 * Cambia la disponibilidad de un miembro DENTRO de la transacción del llamador: cierra el
 * bloque abierto (su fin = ahora), guarda el estado y, si el estado ocupa el calendario,
 * abre un bloque nuevo. Definición única: la usan el selector de Mi día
 * (`POST /api/members/calendar/availability`) y el botón «Completado» de la ventana de
 * tareas de «Trabajando» (`POST /api/members/calendar/work/complete`).
 *
 * El bloque nace con fin provisional a la hora; mientras sigue abierto, quien lo lee lo
 * alarga hasta ahora (`openEndSql`).
 */
export async function setMemberAvailability(
  client: PoolClient, memberId: string, userId: string, status: AvailabilityStatus,
) {
  const meta = AVAILABILITY[status];

  await client.query(
    `UPDATE gcc_world.member_calendar_events
        SET end_at = NOW(), availability_open = FALSE
      WHERE member_id = $1 AND availability_open = TRUE`,
    [memberId],
  );

  await client.query(
    `UPDATE gcc_world.members
        SET availability_status = $1, availability_updated_at = NOW()
      WHERE id = $2`,
    [status, memberId],
  );

  if (!meta.createsEvent) return null;
  const { rows } = await client.query(
    `INSERT INTO gcc_world.member_calendar_events (
       member_id, title, description, event_type, client_id,
       start_at, end_at, all_day, timezone,
       recurrence_type, recurrence_days, recurrence_interval, recurrence_until,
       color, status, created_by,
       availability_status, availability_open
     ) VALUES (
       $1, $2, NULL, 'personal', NULL,
       NOW(), NOW() + INTERVAL '1 hour', FALSE, 'America/Guayaquil',
       'none', NULL, 1, NULL,
       $3, 'confirmed', $4,
       $5, TRUE
     ) RETURNING id, title, start_at, end_at, color`,
    [memberId, meta.eventTitle, meta.color, userId, status],
  );
  return rows[0];
}

/**
 * `end_at` tal como se debe pintar: un bloque de disponibilidad abierto ocupa, como
 * mínimo, hasta este momento. Sin esto, una sesión de tres horas se veía de una sola
 * (su fin provisional) hasta que se cerraba.
 */
export const openEndSql = (alias: string) =>
  `CASE WHEN ${alias}.availability_open THEN GREATEST(${alias}.end_at, NOW()) ELSE ${alias}.end_at END`;
