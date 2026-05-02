-- Fase 11: items en el mapa + inventario por cliente.
-- Aplicar:
--   psql "$DATABASE_URL" -f sql/migrations/011_items_inventory.sql

SET search_path TO gcc_world, public;

ALTER TABLE gcc_world.world_maps
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE gcc_world.clients
  ADD COLUMN IF NOT EXISTS inventory      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS picked_items   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipped_item  VARCHAR(64);
