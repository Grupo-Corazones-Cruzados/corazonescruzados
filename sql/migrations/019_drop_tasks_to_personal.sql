-- Se retira el concepto de "tarea": ahora todo es evento (laboral | personal).
-- Convierte los registros existentes de tipo 'task' a eventos 'personal'
-- (el miembro luego re-clasifica manualmente a laboral/personal según
-- corresponda). Incluye los registros generados por disponibilidad.
-- Las columnas task_status / 'task' en el CHECK se dejan en la BD (inertes,
-- no destructivo); la app ya no las usa.
-- Ejecutar una vez:
--   psql "$DATABASE_URL" -f sql/migrations/019_drop_tasks_to_personal.sql

SET search_path TO gcc_world, public;

UPDATE gcc_world.member_calendar_events
   SET event_type = 'personal',
       task_status = NULL
 WHERE event_type = 'task';
