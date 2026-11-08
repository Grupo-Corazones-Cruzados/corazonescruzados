-- 018 — A QUIÉN SE ASIGNA CADA CONTACTO Y EN QUÉ ESTADO ESTÁ (Fernando, 2026-11-08):
-- «asignar cada contacto a un usuario que se encargará de la conversación» y «pendientes, en
-- proceso y cerrados… por defecto todos los contactos están en estado abierto».
-- · asignada_a_id: la persona responsable (distinto de `tomada_por_id`, que es quién apagó al
--   agente en ella). Si la cuenta se borra, queda sin asignar.
-- · estado_atencion: ABIERTO (por defecto) · EN_PROCESO · CERRADO. Lo cambia una persona a mano.
ALTER TABLE automatizaciones.conversaciones
  ADD COLUMN IF NOT EXISTS asignada_a_id   integer REFERENCES automatizaciones.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estado_atencion varchar(12) NOT NULL DEFAULT 'ABIERTO';
DO $$ BEGIN
  ALTER TABLE automatizaciones.conversaciones
    ADD CONSTRAINT conversaciones_estado_atencion_valido CHECK (estado_atencion IN ('ABIERTO', 'EN_PROCESO', 'CERRADO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS conversaciones_por_asignado ON automatizaciones.conversaciones (inquilino_id, asignada_a_id);
CREATE INDEX IF NOT EXISTS conversaciones_por_estado   ON automatizaciones.conversaciones (inquilino_id, estado_atencion);
