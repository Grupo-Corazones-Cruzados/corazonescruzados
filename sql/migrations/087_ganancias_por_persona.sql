-- FASE 4, PASO 1 DEL MODELO ECONÓMICO (Fernando, 2026-11-09): registro de ganancias por persona.
-- Solo AÑADE (tabla nueva y columnas que admiten NULL): el código desplegado hoy no las mira, así que se puede
-- aplicar antes o después de desplegar `lib/ganancias.ts`. Idempotente: se puede correr más de una vez.

-- El libro de ganancias: una fila por cada parte de un cobro (cada asignación de un requerimiento, el responsable
-- del ticket, el beneficiario de una etapa, el dueño del producto y el resto de GCC). Nace al cobrarse la factura
-- y se marca `reversed` si la factura se anula. La emisión al SRI no cambia: la factura sigue siendo de GCC.
CREATE TABLE IF NOT EXISTS gcc_world.member_earnings (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID NOT NULL,
  member_id         BIGINT,
  -- 'project' | 'ticket' | 'subscription': de dónde sale el cobro.
  source_type       VARCHAR(20) NOT NULL,
  source_id         TEXT NOT NULL,
  invoice_id        INT NOT NULL,
  payment_intent_id BIGINT,
  -- 'assignment' | 'stage' | 'ticket' | 'subscription' | 'gcc' (lo que no se atribuye a nadie).
  role              VARCHAR(20) NOT NULL,
  -- Lo que hace única la parte dentro de su factura: 'a:<asignación>', 'stage', 'ticket', 'subscription', 'gcc'.
  share_key         TEXT NOT NULL,
  requirement_id    BIGINT,
  assignment_id     BIGINT,
  stage_id          BIGINT,
  gross             NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission        NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            VARCHAR(10) NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued', 'reversed')),
  -- La factura anulada de la que se heredó la parte (refactura).
  inherited_from    INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_at       TIMESTAMPTZ,
  CONSTRAINT member_earnings_invoice_share_key UNIQUE (invoice_id, share_key)
);
CREATE INDEX IF NOT EXISTS idx_member_earnings_user ON gcc_world.member_earnings (user_id, status);
CREATE INDEX IF NOT EXISTS idx_member_earnings_source ON gcc_world.member_earnings (source_type, source_id);

-- Quién vende una suscripción: la ficha del marketplace de la que nació y su dueño. NULL = de GCC (todas las que
-- existían y las que crea el administrador a mano).
ALTER TABLE gcc_world.subscriptions ADD COLUMN IF NOT EXISTS portfolio_item_id BIGINT;
ALTER TABLE gcc_world.subscriptions ADD COLUMN IF NOT EXISTS owner_member_id BIGINT;
