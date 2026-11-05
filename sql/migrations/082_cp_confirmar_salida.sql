-- CONTROL PSICOSOCIAL · aviso de salida (Fernando, 2026-11-05). Un salto del GPS no puede avisar a todos
-- de que alguien se fue: la salida se confirma si sigue fuera un rato, y cuenta desde la primera vez fuera.
ALTER TABLE gcc_world.cp_visitas ADD COLUMN IF NOT EXISTS fuera_desde TIMESTAMPTZ;
