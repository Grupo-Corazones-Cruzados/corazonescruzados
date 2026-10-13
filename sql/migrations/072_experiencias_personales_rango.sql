-- ─────────────────────────────────────────────────────────────────────────────
-- 072 · La experiencia personal lleva un RANGO DE FECHAS sin cruces (2026-10-13)
-- ─────────────────────────────────────────────────────────────────────────────
-- Decisión de Fernando: cada experiencia tiene fecha de inicio y de fin (ambas
-- incluidas), y un usuario NO puede tener dos experiencias cuyos rangos se crucen.
-- El cruce lo impide la propia base (EXCLUDE con gist), no solo el código: así ni
-- dos peticiones simultáneas lo cuelan. `btree_gist` hace falta para el `user_id =`.
-- La tabla estaba vacía al aplicar esto (las filas de la prueba se borraron), por eso
-- las columnas entran NOT NULL sin valor por defecto.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

ALTER TABLE gcc_world.exp_personales
  ADD COLUMN IF NOT EXISTS fecha_inicio date NOT NULL,
  ADD COLUMN IF NOT EXISTS fecha_fin    date NOT NULL;

ALTER TABLE gcc_world.exp_personales DROP CONSTRAINT IF EXISTS exp_personales_rango_valido;
ALTER TABLE gcc_world.exp_personales
  ADD CONSTRAINT exp_personales_rango_valido CHECK (fecha_fin >= fecha_inicio);

ALTER TABLE gcc_world.exp_personales DROP CONSTRAINT IF EXISTS exp_personales_sin_cruce;
ALTER TABLE gcc_world.exp_personales
  ADD CONSTRAINT exp_personales_sin_cruce
  EXCLUDE USING gist (user_id WITH =, daterange(fecha_inicio, fecha_fin, '[]') WITH &&);
