-- PAGO POR TRANSFERENCIA BANCARIA, CON CONFIRMACIÓN HUMANA (2026-08-26).
--
-- Fernando: «podemos también ofrecer el método de pago por transacción bancaria, en donde
-- el usuario debe poder ver los datos de la cuenta bancaria a la cual puede depositar…
-- luego adjunta el comprobante… el pago queda en espera de ser confirmado y la confirmación
-- solo la puede hacer el usuario que recibirá el pago desde la página de detalle».
--
-- ── POR QUÉ ESTE CAMINO NO SE PARECE AL DE LA TARJETA ────────────────────────
-- Con PayPhone hay un tercero que dice «este dinero entró»: la pasarela confirma y el
-- sistema se fía de ella. En una transferencia **no hay tercero**. Lo único que llega es una
-- imagen que sube el propio cliente, y **una imagen no prueba nada**: puede ser de otra
-- transferencia, de otro importe, o de otro día. Por eso el estado nuevo no es «pagado»
-- sino `awaiting`, y quien lo mueve a pagado es **una persona que ha mirado su banco**.
--
-- Consecuencia directa: **la factura no se emite al subir el comprobante**, se emite al
-- confirmarlo. Emitirla antes sería facturar sobre la palabra del que paga.
--
-- ⚠️ LAS CUENTAS BANCARIAS NO VIVEN AQUÍ, VIVEN EN EL CÓDIGO (`lib/pagos/cuentas.ts`).
-- Es deliberado: un número de cuenta editable desde el panel es la vía más corta para que
-- quien entre a una sesión de administrador **redirija todos los cobros a su cuenta**, sin
-- tocar una línea de código y sin dejar rastro en git. En el código, cambiarlo exige un
-- despliegue y queda firmado en el historial.

-- ── El estado nuevo ─────────────────────────────────────────────────────────
ALTER TABLE gcc_world.payment_intents
  DROP CONSTRAINT IF EXISTS payment_intents_status_check;

ALTER TABLE gcc_world.payment_intents
  ADD CONSTRAINT payment_intents_status_check
  CHECK (status IN ('pending','processing','awaiting','paid','failed','expired','cancelled'));

COMMENT ON COLUMN gcc_world.payment_intents.status IS
  'pending → processing → paid | failed. `awaiting` es solo de la transferencia: el cliente subió su comprobante y falta que una persona lo confirme contra el banco.';

-- ── El comprobante y su confirmación ────────────────────────────────────────
ALTER TABLE gcc_world.payment_intents
  ADD COLUMN IF NOT EXISTS proof_data     BYTEA,
  ADD COLUMN IF NOT EXISTS proof_type     VARCHAR(60),
  ADD COLUMN IF NOT EXISTS proof_name     VARCHAR(200),
  ADD COLUMN IF NOT EXISTS proof_at       TIMESTAMPTZ,
  -- Lo que el cliente DICE que transfirió. No sustituye al comprobante: le da a quien
  -- confirma un número contra el que cotejar el movimiento en su banco.
  ADD COLUMN IF NOT EXISTS proof_reference VARCHAR(120),
  ADD COLUMN IF NOT EXISTS proof_bank     VARCHAR(40),
  ADD COLUMN IF NOT EXISTS confirmed_by   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS confirmed_at   TIMESTAMPTZ;

COMMENT ON COLUMN gcc_world.payment_intents.proof_data IS
  'La imagen o PDF que subió el cliente. NO es prueba de pago: es lo que mira la persona que confirma.';
COMMENT ON COLUMN gcc_world.payment_intents.confirmed_by IS
  'Quién dio por bueno el comprobante. Un cobro por transferencia siempre tiene un responsable con nombre.';

-- Los cobros a la espera se consultan por origen desde el detalle del proyecto/ticket/etc.,
-- y son pocos: un índice parcial basta y no pesa.
CREATE INDEX IF NOT EXISTS idx_payment_intents_en_espera
  ON gcc_world.payment_intents (source_type, source_id)
  WHERE status = 'awaiting';

-- ⚠️ EL CANDADO ANTI-DOBLE-COBRO SE AMPLÍA A `awaiting`.
--
-- Los índices de la 053 y la 054 solo miran `status = 'paid'`. Sin esto, un cliente podría
-- subir dos comprobantes de la misma etapa —o pagar con tarjeta algo que ya tiene una
-- transferencia esperando— y acabaríamos cobrando dos veces lo mismo. Un cobro a la espera
-- **ocupa el sitio** igual que uno pagado.
DROP INDEX IF EXISTS gcc_world.idx_payment_intents_stage_pagada;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_stage_pagada
  ON gcc_world.payment_intents (stage_id)
  WHERE stage_id IS NOT NULL AND status IN ('paid','awaiting');

DROP INDEX IF EXISTS gcc_world.idx_payment_intents_origen_pagado;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_origen_pagado
  ON gcc_world.payment_intents (source_type, source_id)
  WHERE stage_id IS NULL AND status IN ('paid','awaiting');
