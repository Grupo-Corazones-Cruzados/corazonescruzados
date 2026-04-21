-- Fase 3: suscriptores del calendario público.
-- Ejecutar una vez:
--   psql "$DATABASE_URL" -f sql/migrations/003_member_calendar_subscribers.sql

SET search_path TO gcc_world, public;

CREATE TABLE IF NOT EXISTS gcc_world.member_calendar_subscribers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           BIGINT NOT NULL REFERENCES gcc_world.members(id) ON DELETE CASCADE,
  email               VARCHAR(254) NOT NULL,
  verified            BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token  VARCHAR(64),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at         TIMESTAMPTZ,
  UNIQUE (member_id, email)
);

CREATE INDEX IF NOT EXISTS idx_mcs_member_verified
  ON gcc_world.member_calendar_subscribers (member_id, verified);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mcs_verify_token
  ON gcc_world.member_calendar_subscribers (verification_token)
  WHERE verification_token IS NOT NULL;
