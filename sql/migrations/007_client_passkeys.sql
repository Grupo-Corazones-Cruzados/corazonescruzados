-- Fase 7: passkeys (WebAuthn) para login con biometría / hardware.
-- Aplicar:
--   psql "$DATABASE_URL" -f sql/migrations/007_client_passkeys.sql

SET search_path TO gcc_world, public;

CREATE TABLE IF NOT EXISTS gcc_world.client_passkeys (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             BIGINT NOT NULL REFERENCES gcc_world.clients(id) ON DELETE CASCADE,
  credential_id         TEXT UNIQUE NOT NULL,
  credential_public_key BYTEA NOT NULL,
  counter               BIGINT NOT NULL DEFAULT 0,
  device_type           VARCHAR(32),
  backed_up             BOOLEAN,
  transports            TEXT[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS client_passkeys_client_id_idx
  ON gcc_world.client_passkeys (client_id);

ALTER TABLE gcc_world.clients
  ADD COLUMN IF NOT EXISTS webauthn_challenge      TEXT,
  ADD COLUMN IF NOT EXISTS webauthn_challenge_exp  TIMESTAMPTZ;
