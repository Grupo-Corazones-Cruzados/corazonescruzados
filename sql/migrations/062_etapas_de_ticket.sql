-- ─────────────────────────────────────────────────────────────────────────────
-- 062 · Etapas de pago en TICKETS y varios cobros del saldo (Fernando, 2026-09-30)
-- ─────────────────────────────────────────────────────────────────────────────
-- «Necesito que esto que tenemos en el módulo de proyectos también se pueda gestionar en
-- tickets… pagar por etapas según lo consumido hasta la fecha, o compartir un solo enlace
-- para el pago total de los consumos».
--
-- 1) Las etapas de un ticket viven en la MISMA tabla que las del proyecto, con `ticket_id`.
--    No es por ahorrar una tabla: `payment_intents.stage_id` y su índice único
--    (`idx_payment_intents_stage_pagada`, «una etapa se paga una vez») funcionan por id de
--    etapa. Con una tabla aparte, la etapa 7 de un ticket y la 7 de un proyecto chocarían en
--    ese candado. Una fila es de un proyecto O de un ticket, nunca de los dos.
ALTER TABLE gcc_world.project_stages ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE gcc_world.project_stages ADD COLUMN IF NOT EXISTS ticket_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_project_stages_ticket ON gcc_world.project_stages (ticket_id, sort_order);
ALTER TABLE gcc_world.project_stages DROP CONSTRAINT IF EXISTS project_stages_de_uno;
ALTER TABLE gcc_world.project_stages ADD CONSTRAINT project_stages_de_uno
  CHECK ((project_id IS NULL) <> (ticket_id IS NULL));

-- 2) El cobro del TOTAL de un ticket ya no es «uno en toda su vida».
--    El índice de la 055 impedía un segundo cobro sin etapa por origen: tenía sentido cuando
--    el ticket se cobraba una sola vez al completarse. Ahora el total es LO CONSUMIDO, que
--    sigue creciendo, y se puede cobrar el saldo varias veces. Para tickets el candado pasa a:
--      · como mucho UNA transferencia en espera a la vez (índice de abajo), y
--      · lo pendiente descuenta lo ya cobrado aunque aún no tenga factura (en la aplicación),
--        así que el mismo saldo no se puede cobrar dos veces.
--    Proyectos, suscripciones y productos siguen exactamente igual.
DROP INDEX IF EXISTS gcc_world.idx_payment_intents_origen_pagado;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_origen_pagado
  ON gcc_world.payment_intents (source_type, source_id)
  WHERE stage_id IS NULL AND status IN ('paid','awaiting') AND source_type <> 'ticket';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_ticket_en_espera
  ON gcc_world.payment_intents (source_id)
  WHERE source_type = 'ticket' AND stage_id IS NULL AND status = 'awaiting';
