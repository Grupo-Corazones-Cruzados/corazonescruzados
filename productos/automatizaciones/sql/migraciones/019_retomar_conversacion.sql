-- 019 — EL AGENTE RETOMA SOLO LA CONVERSACIÓN QUE TOMÓ UNA PERSONA (Fernando, 2026-11-10):
-- «que la vuelva a tomar el agente de IA después de 6 horas de la última vez que respondió y tomó
-- la conversación un usuario… configurar en Estudio… desde 1 minuto hasta cantidad de días».
-- · retomar_minutos: cuánto se espera desde lo ÚLTIMO que hizo una persona en la conversación (la
--   tomó o le escribió). Por defecto 6 horas. Entre 1 minuto y 365 días.
ALTER TABLE automatizaciones.canales
  ADD COLUMN IF NOT EXISTS retomar_minutos integer NOT NULL DEFAULT 360;
DO $$ BEGIN
  ALTER TABLE automatizaciones.canales
    ADD CONSTRAINT canales_retomar_minutos_valido CHECK (retomar_minutos BETWEEN 1 AND 525600);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Para encontrar rápido lo último que escribió el equipo en una conversación.
CREATE INDEX IF NOT EXISTS mensajes_equipo_por_conversacion
  ON automatizaciones.mensajes (conversacion_id, creado_en DESC)
  WHERE direccion = 'SALIENTE' AND herramienta = 'equipo';
