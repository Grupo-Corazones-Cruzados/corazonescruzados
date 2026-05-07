-- Fase 14: luces colocables en el mapa + oscuridad ambiental por mapa.
-- Aplicar:
--   psql "$DATABASE_URL" -f sql/migrations/014_lights.sql

SET search_path TO gcc_world, public;

ALTER TABLE gcc_world.world_maps
  ADD COLUMN IF NOT EXISTS ambient_darkness REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS gcc_world.lights (
  id          SERIAL PRIMARY KEY,
  map_name    VARCHAR(64)  NOT NULL DEFAULT 'default',
  x           INTEGER      NOT NULL,
  y           INTEGER      NOT NULL,
  radius      REAL         NOT NULL DEFAULT 4,
  color       VARCHAR(16)  NOT NULL DEFAULT '#ffd27a',
  mode        VARCHAR(16)  NOT NULL DEFAULT 'steady',
  period_ms   INTEGER      NOT NULL DEFAULT 1000,
  intensity   REAL         NOT NULL DEFAULT 1.0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lights_map_idx ON gcc_world.lights (map_name);
