-- Fase 13: animación por defecto del NPC.
-- Aplicar:
--   psql "$DATABASE_URL" -f sql/migrations/013_npc_animation.sql

SET search_path TO gcc_world, public;

ALTER TABLE gcc_world.npcs
  ADD COLUMN IF NOT EXISTS animation VARCHAR(16) NOT NULL DEFAULT 'idle';
