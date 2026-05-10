-- Fase 15: escenas (motor de juego). Cada escena es un mapa independiente
-- (kind='map') o una cinemática disparada por evento (kind='cinematic').
-- Aplicar:
--   psql "$DATABASE_URL" -f sql/migrations/015_scenes.sql

SET search_path TO gcc_world, public;

CREATE TABLE IF NOT EXISTS gcc_world.scenes (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(64) UNIQUE NOT NULL,
  kind          VARCHAR(16) NOT NULL CHECK (kind IN ('map','cinematic')),
  name          VARCHAR(128) NOT NULL,
  order_idx     INTEGER NOT NULL DEFAULT 0,
  music_url     TEXT,
  music_volume  REAL NOT NULL DEFAULT 0.5,
  -- Sólo cinemáticas. Único por evento → resolución determinista en runtime.
  event_trigger VARCHAR(64),
  -- frames[] para cinemáticas; reservado para mapas.
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scenes_kind_idx ON gcc_world.scenes (kind);
CREATE UNIQUE INDEX IF NOT EXISTS scenes_event_trigger_unique
  ON gcc_world.scenes (event_trigger)
  WHERE kind = 'cinematic' AND event_trigger IS NOT NULL;

-- Transiciones (puertas) por escena de mapa.
ALTER TABLE gcc_world.world_maps
  ADD COLUMN IF NOT EXISTS transitions JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Empezar de cero: el usuario decidió crear escenas vacías desde el editor.
TRUNCATE gcc_world.world_maps RESTART IDENTITY CASCADE;
DELETE FROM gcc_world.npcs;
DELETE FROM gcc_world.lights;

-- Una escena de mapa inicial para que el runtime tenga dónde aterrizar.
INSERT INTO gcc_world.scenes (slug, kind, name, order_idx)
VALUES ('main', 'map', 'Mapa principal', 0)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO gcc_world.world_maps
  (name, width, height, layers, items, spawn_x, spawn_y, ambient_darkness, transitions)
VALUES ('main', 60, 40, '[]'::jsonb, '[]'::jsonb, 30, 20, 0, '[]'::jsonb)
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS world_maps_name_idx ON gcc_world.world_maps (name);
