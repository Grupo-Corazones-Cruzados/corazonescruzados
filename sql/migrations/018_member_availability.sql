-- Disponibilidad del miembro.
-- members.availability_status: estado actual visible en el calendario público.
-- member_calendar_events.availability_status / availability_open: la tarea
-- automática que se crea al elegir 'ocupado' | 'descanso' | 'fuera_de_casa'.
-- La tarea queda "abierta" hasta que el miembro cambia de estado: en ese
-- momento su end_at se fija al instante del cambio.
-- Ejecutar una vez:
--   psql "$DATABASE_URL" -f sql/migrations/018_member_availability.sql

SET search_path TO gcc_world, public;

ALTER TABLE gcc_world.members
  ADD COLUMN IF NOT EXISTS availability_status VARCHAR(16) NOT NULL DEFAULT 'conectado';
ALTER TABLE gcc_world.members
  ADD COLUMN IF NOT EXISTS availability_updated_at TIMESTAMPTZ;

ALTER TABLE gcc_world.members
  DROP CONSTRAINT IF EXISTS members_availability_chk;
ALTER TABLE gcc_world.members
  ADD CONSTRAINT members_availability_chk
  CHECK (availability_status IN ('conectado', 'ocupado', 'descanso', 'fuera_de_casa'));

ALTER TABLE gcc_world.member_calendar_events
  ADD COLUMN IF NOT EXISTS availability_status VARCHAR(16);
ALTER TABLE gcc_world.member_calendar_events
  ADD COLUMN IF NOT EXISTS availability_open BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE gcc_world.member_calendar_events
  DROP CONSTRAINT IF EXISTS mce_availability_chk;
ALTER TABLE gcc_world.member_calendar_events
  ADD CONSTRAINT mce_availability_chk
  CHECK (availability_status IS NULL
         OR availability_status IN ('ocupado', 'descanso', 'fuera_de_casa'));

-- A lo sumo una tarea de disponibilidad abierta por miembro.
CREATE INDEX IF NOT EXISTS idx_mce_avail_open
  ON gcc_world.member_calendar_events (member_id)
  WHERE availability_open;
