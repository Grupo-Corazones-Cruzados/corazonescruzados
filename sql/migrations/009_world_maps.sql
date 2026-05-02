-- Fase 9: tabla de mapas del mundo, editable por admin global.
-- Aplicar:
--   psql "$DATABASE_URL" -f sql/migrations/009_world_maps.sql

SET search_path TO gcc_world, public;

CREATE TABLE IF NOT EXISTS gcc_world.world_maps (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(64) UNIQUE NOT NULL,
  width       INT NOT NULL,
  height      INT NOT NULL,
  layers      JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO gcc_world.world_maps (name, width, height, layers)
VALUES ('default', 60, 40, '[]'::jsonb)
ON CONFLICT (name) DO NOTHING;
