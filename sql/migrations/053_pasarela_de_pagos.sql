-- LA PASARELA DE PAGO: QUE EL CLIENTE PAGUE SOLO (2026-08-25).
--
-- Fernando abre el frente: «la pasarela de pago que usaremos en nuestra plataforma
-- servirá para todos los pagos… productos, proyectos, u automatizaciones».
--
-- ⚠️ EL COBRO MANUAL DE HOY NO SE SUSTITUYE, SE SUMA. Siguen conviviendo TRES canales:
--   1. `manual` — el responsable factura y adjunta el comprobante (lo de siempre).
--   2. `client` — el cliente entra a su proyecto y paga una etapa él mismo.
--   3. `link`   — enlace con token y caducidad, enviado por correo, sin cuenta.
-- Los tres escriben en `payment_intents`, para que el histórico de cobros no viva en
-- dos sitios distintos según por dónde entró el dinero.
--
-- ⚠️ LA FACTURA SE EMITE CUANDO EL PAGO SE CONFIRMA, NUNCA ANTES (decisión de Fernando).
-- Una factura autorizada no se borra: se anula con nota de crédito. Emitir antes de
-- cobrar convertiría cada pago fallido en una nota de crédito. Al revés no cuesta nada.
--
-- ⚠️ EL RECARGO DE LA PASARELA LO PAGA EL CLIENTE, EN LÍNEA APARTE (decisión de Fernando).
-- Por eso el intento guarda los TRES importes por separado: `net_amount` es lo que se
-- pactó en el plan de etapas y lo que debe llegar a GCC; `fee_amount` es el recargo; y
-- `charge_amount` es lo que el cliente paga. Guardarlos separados no es un lujo: la
-- tarjeta de Pagos del proyecto calcula «por facturar» restando el total de las facturas
-- al costo del proyecto, así que sin saber cuánto de la factura era recargo el proyecto
-- se daría por facturado antes de tiempo.

-- ── Intentos de cobro ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gcc_world.payment_intents (
  id                 BIGSERIAL PRIMARY KEY,

  -- Qué se está cobrando. `source_type`/`source_id` siguen la misma convención que
  -- `invoices.source_type`/`source_id`, para que un cobro se pueda cruzar con su factura.
  source_type        VARCHAR(20)  NOT NULL,
  source_id          TEXT         NOT NULL,
  stage_id           BIGINT,

  channel            VARCHAR(20)  NOT NULL,
  provider           VARCHAR(20)  NOT NULL,

  net_amount         NUMERIC(12,2) NOT NULL,
  fee_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  charge_amount      NUMERIC(12,2) NOT NULL,
  currency           VARCHAR(3)    NOT NULL DEFAULT 'USD',

  status             VARCHAR(20)  NOT NULL DEFAULT 'pending',

  -- Lo que devuelve el proveedor. `provider_method` decide el `formaPago` del XML del
  -- SRI (19 tarjeta de crédito · 16 débito · 20 transferencia), que hasta ahora era
  -- una elección de pantalla y con la pasarela pasa a ser un dato del cobro.
  provider_reference TEXT,
  provider_method    VARCHAR(20),
  provider_status    TEXT,

  -- Los datos de facturación CONGELADOS en el momento del cobro. Si el cliente edita
  -- su cuenta de facturación entre que paga y que se emite, la factura tiene que salir
  -- con lo que él aceptó al pagar, no con lo que haya después.
  billing_snapshot   JSONB,
  payer_email        VARCHAR(255),

  invoice_id         INT,
  failure_reason     TEXT,

  created_by         INT,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_intents_status_check
    CHECK (status IN ('pending','processing','paid','failed','expired','cancelled')),
  CONSTRAINT payment_intents_channel_check
    CHECK (channel IN ('manual','client','link')),
  CONSTRAINT payment_intents_amounts_check
    CHECK (net_amount >= 0 AND fee_amount >= 0 AND charge_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_source
  ON gcc_world.payment_intents (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_stage
  ON gcc_world.payment_intents (stage_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_invoice
  ON gcc_world.payment_intents (invoice_id);

-- 🔑 UNA ETAPA NO SE COBRA DOS VECES. Este índice es el candado de verdad: aunque el
-- cliente abra el enlace en dos pestañas y pague dos veces, el segundo intento no puede
-- llegar a `paid`. Los intentos abandonados (`pending`, `failed`, `expired`) no estorban,
-- que es justo lo que hace falta para poder reintentar un pago que salió mal.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_stage_pagada
  ON gcc_world.payment_intents (stage_id)
  WHERE stage_id IS NOT NULL AND status = 'paid';

-- 🔑 LA REFERENCIA DEL PROVEEDOR ES ÚNICA. La pasarela reintenta el webhook hasta que
-- responde 200; sin esto, un reintento emitiría un segundo comprobante del mismo cobro.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_referencia
  ON gcc_world.payment_intents (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

COMMENT ON TABLE gcc_world.payment_intents IS
  'Un intento de cobro, venga del canal que venga (manual, cliente o enlace). La factura se emite al confirmarse, nunca antes.';
COMMENT ON COLUMN gcc_world.payment_intents.net_amount IS
  'Lo pactado en el plan de etapas: lo que debe llegar a GCC. NO incluye el recargo de la pasarela.';
COMMENT ON COLUMN gcc_world.payment_intents.fee_amount IS
  'El recargo de la pasarela, trasladado al cliente en línea aparte de la factura (decisión de Fernando, 2026-08-25).';
COMMENT ON COLUMN gcc_world.payment_intents.charge_amount IS
  'Lo que el cliente paga = net_amount + fee_amount. Es el total de la factura.';
COMMENT ON COLUMN gcc_world.payment_intents.billing_snapshot IS
  'Datos de facturación congelados al pagar. La factura sale con lo que el cliente aceptó, no con lo que haya después.';

-- ── Eventos recibidos del proveedor ──────────────────────────────────────────
-- El webhook es la ÚNICA fuente de verdad del pago, así que cada evento se guarda
-- entero antes de tocar nada. Sirve para dos cosas: idempotencia dura (el UNIQUE de
-- abajo) y para poder reconstruir qué dijo la pasarela cuando un cobro se discuta.
CREATE TABLE IF NOT EXISTS gcc_world.payment_events (
  id           BIGSERIAL PRIMARY KEY,
  provider     VARCHAR(20) NOT NULL,
  event_id     TEXT        NOT NULL,
  intent_id    BIGINT,
  payload      JSONB       NOT NULL,
  handled      BOOLEAN     NOT NULL DEFAULT false,
  handled_note TEXT,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_unico
  ON gcc_world.payment_events (provider, event_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_intent
  ON gcc_world.payment_events (intent_id);

-- ── Enlaces de pago (canal 3) ────────────────────────────────────────────────
-- «el usuario miembro responsable del proyecto define el tiempo máximo de duración
-- del token». Por eso `expires_at` no tiene valor por defecto en la base: lo pone
-- quien comparte el enlace, a conciencia.
CREATE TABLE IF NOT EXISTS gcc_world.payment_links (
  id          BIGSERIAL PRIMARY KEY,
  token       VARCHAR(64)  NOT NULL,
  source_type VARCHAR(20)  NOT NULL,
  source_id   TEXT         NOT NULL,
  stage_id    BIGINT,
  email       VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_by  INT,
  intent_id   BIGINT,
  sent_at     TIMESTAMPTZ,
  opened_at   TIMESTAMPTZ,
  paid_at     TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_links_token
  ON gcc_world.payment_links (token);
CREATE INDEX IF NOT EXISTS idx_payment_links_source
  ON gcc_world.payment_links (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_stage
  ON gcc_world.payment_links (stage_id);

COMMENT ON COLUMN gcc_world.payment_links.expires_at IS
  'Sin valor por defecto A PROPÓSITO: la caducidad la elige el responsable al compartir el enlace.';

-- ── La factura sabe de dónde salió el dinero ─────────────────────────────────
-- Sin esto, una factura emitida por la pasarela es indistinguible de una manual, y el
-- día que haya que conciliar con la liquidación del proveedor no habría por dónde empezar.
ALTER TABLE gcc_world.invoices
  ADD COLUMN IF NOT EXISTS payment_intent_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_intent
  ON gcc_world.invoices (payment_intent_id);

COMMENT ON COLUMN gcc_world.invoices.payment_intent_id IS
  'El cobro que originó esta factura. NULL = factura del canal manual, que se paga adjuntando el comprobante.';
