-- Fase 12: NPCs colocables en el mapa.
-- Aplicar:
--   psql "$DATABASE_URL" -f sql/migrations/012_npcs.sql

SET search_path TO gcc_world, public;

CREATE TABLE IF NOT EXISTS gcc_world.npcs (
  id          SERIAL PRIMARY KEY,
  map_name    VARCHAR(64)  NOT NULL DEFAULT 'default',
  name        VARCHAR(128) NOT NULL,
  config      JSONB        NOT NULL,
  x           INTEGER      NOT NULL,
  y           INTEGER      NOT NULL,
  facing      VARCHAR(2)   NOT NULL DEFAULT 's',
  dialogue    JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS npcs_map_idx ON gcc_world.npcs (map_name);
