-- Tareas en el Calendario del Miembro.
-- Reutiliza member_calendar_events: una tarea es un evento con event_type='task'
-- y un estado de avance (task_status). Aparece en el calendario según su
-- fecha/hora, en la vista pública y en las notificaciones a suscriptores.
-- Ejecutar una vez contra la base de datos:
--   psql "$DATABASE_URL" -f sql/migrations/017_member_calendar_tasks.sql

SET search_path TO gcc_world, public;

-- Permitir el nuevo tipo 'task' además de 'work' | 'personal'.
ALTER TABLE gcc_world.member_calendar_events
  DROP CONSTRAINT IF EXISTS member_calendar_events_type_chk;
ALTER TABLE gcc_world.member_calendar_events
  ADD CONSTRAINT member_calendar_events_type_chk
  CHECK (event_type IN ('work', 'personal', 'task'));

-- Estado de la tarea. NULL para eventos no-tarea.
-- 'pending'  -> tarea por hacer
-- 'done'     -> tarea completada
ALTER TABLE gcc_world.member_calendar_events
  ADD COLUMN IF NOT EXISTS task_status VARCHAR(16);

ALTER TABLE gcc_world.member_calendar_events
  DROP CONSTRAINT IF EXISTS member_calendar_events_task_status_chk;
ALTER TABLE gcc_world.member_calendar_events
  ADD CONSTRAINT member_calendar_events_task_status_chk
  CHECK (task_status IS NULL OR task_status IN ('pending', 'done'));
