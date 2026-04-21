-- Fase 2: token público para compartir el calendario del miembro.
-- Ejecutar una vez:
--   psql "$DATABASE_URL" -f sql/migrations/002_member_calendar_public.sql

SET search_path TO gcc_world, public;

ALTER TABLE gcc_world.members
  ADD COLUMN IF NOT EXISTS calendar_public_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS calendar_public_token_created_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_calendar_public_token
  ON gcc_world.members (calendar_public_token)
  WHERE calendar_public_token IS NOT NULL;
