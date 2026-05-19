-- "Fuera de casa" se creaba con color negro (#000000), invisible sobre el
-- fondo negro del calendario. Recolorea los eventos existentes a gris pizarra.
-- Ejecutar una vez:
--   psql "$DATABASE_URL" -f sql/migrations/020_fix_fuera_de_casa_color.sql

SET search_path TO gcc_world, public;

UPDATE gcc_world.member_calendar_events
   SET color = '#475569'
 WHERE availability_status = 'fuera_de_casa'
   AND (color = '#000000' OR color IS NULL);
