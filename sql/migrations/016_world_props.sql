-- Fase 16: props del mundo (objetos no recogibles). Cada prop vive en una
-- celda; puede ser sólido (bloquea al jugador), puede emitir luz, y puede
-- tener un trigger que se ejecute al interactuar (E) o al pisarlo.
--
-- Forma de cada prop dentro del JSONB array:
--   {
--     id: string,
--     x: int, y: int,
--     itemId: string,            // sprite del catálogo de items
--     solid?: boolean,
--     light?: {
--       radius: number, color: string, mode: string,
--       periodMs: number, intensity: number
--     } | null,
--     trigger?: {
--       activation: 'interact'|'step',
--       kind: 'tile-change'|'cinematic'|'layer-toggle',
--       // payload (depende de kind):
--       tile?: { layerId: string, x: int, y: int, sprite?: Tile|null },
--       cinematicSlug?: string,
--       layerId?: string
--     } | null
--   }
--
-- Aplicar:
--   psql "$DATABASE_URL" -f sql/migrations/016_world_props.sql

SET search_path TO gcc_world, public;

ALTER TABLE gcc_world.world_maps
  ADD COLUMN IF NOT EXISTS props JSONB NOT NULL DEFAULT '[]'::jsonb;
