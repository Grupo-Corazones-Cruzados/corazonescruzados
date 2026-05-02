-- Fase 4: alias y datos del personaje del cliente.
-- Ejecutar una vez:
--   psql "$DATABASE_URL" -f sql/migrations/004_clients_character.sql

SET search_path TO gcc_world, public;

ALTER TABLE gcc_world.clients
  ADD COLUMN IF NOT EXISTS alias          VARCHAR(64),
  ADD COLUMN IF NOT EXISTS character_data JSONB;

CREATE INDEX IF NOT EXISTS clients_alias_idx
  ON gcc_world.clients (alias);
