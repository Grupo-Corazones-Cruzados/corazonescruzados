-- ─────────────────────────────────────────────────────────────────────────────
-- 065 · Mi día ▸ estado «Trabajando» y su lista de tareas (Fernando, 2026-10-01)
-- ─────────────────────────────────────────────────────────────────────────────
-- «Trabajando» es un estado de disponibilidad más: como «Ocupado», abre un bloque en el
-- calendario que dura lo que dure el estado. Lo nuevo es que esa sesión lleva una lista de
-- tareas, que se ve después en el detalle del bloque.
--
-- Las tareas cuelgan del BLOQUE (`member_calendar_events.id`), no del día ni del miembro a
-- secas: así el detalle de cada sesión enseña justo lo que se hizo en ella. El bloque se
-- cierra y se edita con UPDATE (nunca se borra y reinserta), por eso la cascada es segura.
--
-- `completed_at` lo pone SOLO el botón «Completado» (a todas las tareas de la sesión a la
-- vez). La casilla de cada tarea en la ventana es visual y no se guarda. Si la sesión se
-- cierra cambiando el estado con el selector, las tareas quedan con `completed_at` NULL.

ALTER TABLE gcc_world.members DROP CONSTRAINT IF EXISTS members_availability_chk;
ALTER TABLE gcc_world.members ADD CONSTRAINT members_availability_chk
  CHECK (availability_status IN ('conectado', 'ocupado', 'trabajando', 'descanso', 'fuera_de_casa'));

ALTER TABLE gcc_world.member_calendar_events DROP CONSTRAINT IF EXISTS mce_availability_chk;
ALTER TABLE gcc_world.member_calendar_events ADD CONSTRAINT mce_availability_chk
  CHECK (availability_status IS NULL OR availability_status IN ('ocupado', 'trabajando', 'descanso', 'fuera_de_casa'));

CREATE TABLE IF NOT EXISTS gcc_world.member_work_tasks (
  id           BIGSERIAL PRIMARY KEY,
  event_id     UUID   NOT NULL REFERENCES gcc_world.member_calendar_events(id) ON DELETE CASCADE,
  member_id    BIGINT NOT NULL REFERENCES gcc_world.members(id) ON DELETE CASCADE,
  title        TEXT   NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS member_work_tasks_event_idx ON gcc_world.member_work_tasks (event_id, created_at);
