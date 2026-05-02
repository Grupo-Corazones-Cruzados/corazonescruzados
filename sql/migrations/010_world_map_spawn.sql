-- Fase 10: posición inicial del personaje en cada mapa.
-- Aplicar:
--   psql "$DATABASE_URL" -f sql/migrations/010_world_map_spawn.sql

SET search_path TO gcc_world, public;

ALTER TABLE gcc_world.world_maps
  ADD COLUMN IF NOT EXISTS spawn_x INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS spawn_y INT NOT NULL DEFAULT 20;
