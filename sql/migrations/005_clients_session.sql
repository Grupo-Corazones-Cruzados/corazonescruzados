-- Fase 5: sesión y autenticación de jugadores (cookie + IP + password).
-- Aplicar:
--   psql "$DATABASE_URL" -f sql/migrations/005_clients_session.sql

SET search_path TO gcc_world, public;

ALTER TABLE gcc_world.clients
  ADD COLUMN IF NOT EXISTS client_token            VARCHAR(64),
  ADD COLUMN IF NOT EXISTS ip_hash                 VARCHAR(64),
  ADD COLUMN IF NOT EXISTS password_hash           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pending_password_hash   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pending_email           VARCHAR(254),
  ADD COLUMN IF NOT EXISTS email_verified          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_token      VARCHAR(64),
  ADD COLUMN IF NOT EXISTS verification_expires    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at            TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS clients_client_token_uniq
  ON gcc_world.clients (client_token)
  WHERE client_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS clients_ip_hash_idx
  ON gcc_world.clients (ip_hash)
  WHERE ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS clients_verification_token_idx
  ON gcc_world.clients (verification_token)
  WHERE verification_token IS NOT NULL;
