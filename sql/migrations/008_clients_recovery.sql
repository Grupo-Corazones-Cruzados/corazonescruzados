-- Fase 8: recuperación de cuenta por correo + código.
-- Aplicar:
--   psql "$DATABASE_URL" -f sql/migrations/008_clients_recovery.sql

SET search_path TO gcc_world, public;

ALTER TABLE gcc_world.clients
  ADD COLUMN IF NOT EXISTS recovery_code     VARCHAR(16),
  ADD COLUMN IF NOT EXISTS recovery_code_exp TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS clients_recovery_code_idx
  ON gcc_world.clients (recovery_code)
  WHERE recovery_code IS NOT NULL;
