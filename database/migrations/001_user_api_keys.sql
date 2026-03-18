-- Migration: Create user_api_keys table
-- Run: psql $DATABASE_URL -f database/migrations/001_user_api_keys.sql

CREATE TABLE IF NOT EXISTS user_api_keys (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service     VARCHAR(50) NOT NULL,
  api_key     TEXT NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uak_user_service ON user_api_keys(user_id, service);
CREATE INDEX IF NOT EXISTS idx_uak_user ON user_api_keys(user_id);

DROP TRIGGER IF EXISTS trg_user_api_keys_updated ON user_api_keys;
CREATE TRIGGER trg_user_api_keys_updated BEFORE UPDATE ON user_api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at();
