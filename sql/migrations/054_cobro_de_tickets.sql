-- EL COBRO EN LÍNEA LLEGA A LOS TICKETS (2026-08-26).
--
-- Fernando: «trabajemos también en tickets». Los proyectos se cobran por ETAPA del plan y
-- ahí el candado anti-doble-cobro es el índice único sobre `stage_id`. Un ticket **no
-- tiene etapas**: se cobra su saldo, y con `stage_id = NULL` ese índice no protege nada —
-- un índice único parcial ignora las filas donde la columna es NULL.
--
-- ⚠️ SIN ESTA MIGRACIÓN, UN TICKET SE PODRÍA COBRAR DOS VECES. Es literalmente el mismo
-- agujero que el `stage_id` tapa en proyectos, pero por la puerta de al lado.
--
-- ── LA DECISIÓN QUE HAY DETRÁS ───────────────────────────────────────────────
-- En la v1, **el cobro en línea de un ticket es del saldo completo y una sola vez.** El
-- «abono parcial» que hoy admite el ticket sigue existiendo por el canal MANUAL, donde lo
-- controla una persona. No se abre a la pasarela porque:
--   1. Fernando y su contadora aún no han cerrado cómo se factura un abono de ticket
--      (anotado desde el 2026-08-19), y
--   2. permitir varios cobros parciales por pasarela obliga a renunciar a este candado,
--      que es lo único que impide cobrarle dos veces a un cliente que hace doble clic.
-- Cuando se decida lo del abono, se cambia este índice a conciencia, no por accidente.

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_origen_pagado
  ON gcc_world.payment_intents (source_type, source_id)
  WHERE stage_id IS NULL AND status = 'paid';

COMMENT ON INDEX gcc_world.idx_payment_intents_origen_pagado IS
  'Un origen SIN etapas (ticket, producto) se cobra una sola vez. El índice de stage_id no cubre estas filas porque su stage_id es NULL.';

-- Los tickets ya tenían `public_token` y `public_token_expires_at` —el enlace del correo de
-- su factura—, así que el canal 3 no necesita columnas nuevas. Solo se asegura el índice
-- que hace barata la búsqueda por token, que hasta ahora no existía: se llegaba al ticket
-- por su id y el token solo se comparaba después.
CREATE INDEX IF NOT EXISTS idx_tickets_public_token
  ON gcc_world.tickets (public_token)
  WHERE public_token IS NOT NULL;
