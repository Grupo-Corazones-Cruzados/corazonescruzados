-- Fase 6: token de sesión autenticada para jugadores.
-- Aplicar:
--   psql "$DATABASE_URL" -f sql/migrations/006_clients_auth_session.sql

SET search_path TO gcc_world, public;

ALTER TABLE gcc_world.clients
  ADD COLUMN IF NOT EXISTS auth_token   VARCHAR(64),
  ADD COLUMN IF NOT EXISTS auth_expires TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS clients_auth_token_idx
  ON gcc_world.clients (auth_token)
  WHERE auth_token IS NOT NULL;
