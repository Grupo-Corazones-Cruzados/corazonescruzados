-- Fase 1 del módulo Calendario del Miembro.
-- Ejecutar una vez contra la base de datos:
--   psql "$DATABASE_URL" -f sql/migrations/001_member_calendar.sql

SET search_path TO gcc_world, public;

CREATE TABLE IF NOT EXISTS gcc_world.member_calendar_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id          BIGINT NOT NULL REFERENCES gcc_world.members(id) ON DELETE CASCADE,

  title              VARCHAR(200) NOT NULL,
  description        TEXT,

  -- 'work' | 'personal'
  event_type         VARCHAR(16) NOT NULL DEFAULT 'work',
  client_id          BIGINT REFERENCES gcc_world.clients(id) ON DELETE SET NULL,

  -- Marca temporal absoluta (UTC). La UI convierte a America/Guayaquil (GMT-5).
  start_at           TIMESTAMPTZ NOT NULL,
  end_at             TIMESTAMPTZ NOT NULL,
  all_day            BOOLEAN NOT NULL DEFAULT FALSE,
  timezone           VARCHAR(64) NOT NULL DEFAULT 'America/Guayaquil',

  -- Recurrencia. Series única: una fila representa toda la serie.
  -- 'none' | 'daily' | 'weekly' | 'monthly'
  recurrence_type    VARCHAR(16) NOT NULL DEFAULT 'none',
  -- Para weekly: días de la semana 0=Dom .. 6=Sáb. Para daily/monthly null.
  recurrence_days    SMALLINT[],
  recurrence_interval SMALLINT NOT NULL DEFAULT 1 CHECK (recurrence_interval >= 1),
  recurrence_until   DATE,

  -- Color de presentación opcional (hex). Se deriva del tipo si queda null.
  color              VARCHAR(9),

  -- 'confirmed' | 'proposed' | 'cancelled'. Fase 1 sólo usa 'confirmed'.
  status             VARCHAR(16) NOT NULL DEFAULT 'confirmed',

  created_by         UUID REFERENCES gcc_world.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT member_calendar_events_type_chk CHECK (event_type IN ('work', 'personal')),
  CONSTRAINT member_calendar_events_recur_chk CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly')),
  CONSTRAINT member_calendar_events_status_chk CHECK (status IN ('confirmed', 'proposed', 'cancelled')),
  CONSTRAINT member_calendar_events_time_chk CHECK (end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_mce_member_start ON gcc_world.member_calendar_events (member_id, start_at);
CREATE INDEX IF NOT EXISTS idx_mce_client ON gcc_world.member_calendar_events (client_id);

-- Trigger para mantener updated_at
CREATE OR REPLACE FUNCTION gcc_world.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mce_updated_at ON gcc_world.member_calendar_events;
CREATE TRIGGER trg_mce_updated_at
  BEFORE UPDATE ON gcc_world.member_calendar_events
  FOR EACH ROW EXECUTE FUNCTION gcc_world.touch_updated_at();
