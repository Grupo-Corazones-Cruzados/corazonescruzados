-- 020 — VARIOS NÚMEROS POR INQUILINO Y DOS MÉTODOS DE CONEXIÓN (Fernando, 2026-11-10):
-- «implementar la conexión Cloud API como otro método para conectar números… si requiero conectar
-- un número adicional en el tenant, debo elegir entre coexistencia y Cloud API, y la llamada va a
-- estar habilitada solo para recibir llamadas».
-- · metodo: COEXISTENCIA (el número sigue en la app WhatsApp Business; Meta no deja llamadas) o
--   CLOUD_API (solo en la API: chats y llamadas entrantes se atienden en el producto).
-- · llamadas: NO · ACTIVAS · ERROR (se intentó activar en Meta y falló; el motivo en llamadas_error).
-- Cada número sigue siendo su propio canal con su propia automatización AGENTE_IA.
ALTER TABLE automatizaciones.canales
  ADD COLUMN IF NOT EXISTS metodo         varchar(12) NOT NULL DEFAULT 'COEXISTENCIA',
  ADD COLUMN IF NOT EXISTS llamadas       varchar(10) NOT NULL DEFAULT 'NO',
  ADD COLUMN IF NOT EXISTS llamadas_error text;
DO $$ BEGIN
  ALTER TABLE automatizaciones.canales
    ADD CONSTRAINT canales_metodo_valido CHECK (metodo IN ('COEXISTENCIA', 'CLOUD_API'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE automatizaciones.canales
    ADD CONSTRAINT canales_llamadas_valido CHECK (llamadas IN ('NO', 'ACTIVAS', 'ERROR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
