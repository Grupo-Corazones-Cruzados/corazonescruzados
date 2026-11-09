-- FASE 4, PASO 2 DEL MODELO ECONÓMICO (Fernando, 2026-11-09): pagos a miembros.
-- GCC cobra todo; después paga a cada miembro o candidato lo que ganó (`member_earnings`, `accrued`, neto `amount`).
-- Solo AÑADE (tablas nuevas y columnas que admiten NULL): el código desplegado hoy no las mira, así que se puede
-- aplicar antes de desplegar `lib/pagos-miembros.ts`. Idempotente: se puede correr más de una vez.

-- La cuenta bancaria a la que se le transfiere: UNA por usuario, y solo la edita su dueño. El número va CIFRADO
-- (`lib/cifrado.ts`, contexto `member_bank_accounts:<usuario>:account_number`); en claro solo los 4 últimos dígitos.
CREATE TABLE IF NOT EXISTS gcc_world.member_bank_accounts (
  user_id            UUID PRIMARY KEY,
  holder_name        TEXT NOT NULL,
  -- Cédula (10 dígitos) o RUC (13).
  holder_id_number   VARCHAR(13) NOT NULL,
  bank_name          TEXT NOT NULL,
  account_type       VARCHAR(10) NOT NULL CHECK (account_type IN ('ahorros', 'corriente')),
  account_number_enc TEXT NOT NULL,
  account_last4      VARCHAR(4) NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by         UUID NOT NULL
);

-- Quién tocó o miró la cuenta y cuándo. NUNCA el número: solo qué campos cambiaron y los 4 últimos dígitos.
-- 'viewed' = el administrador la vio descifrada al registrar un pago.
CREATE TABLE IF NOT EXISTS gcc_world.member_bank_account_log (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL,
  action         VARCHAR(10) NOT NULL CHECK (action IN ('created', 'updated', 'viewed')),
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  account_last4  VARCHAR(4),
  actor_user_id  UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_bank_account_log_user ON gcc_world.member_bank_account_log (user_id, created_at DESC);

-- Cada transferencia hecha a una persona. Junta las ganancias que paga (`member_earnings.payout_id`) y descuenta
-- las que se revirtieron después de pagadas (`member_earnings.deducted_payout_id`). Anular un pago (`voided`)
-- suelta unas y otras. La cuenta usada se copia SIN el número (banco, tipo, 4 últimos, titular).
CREATE TABLE IF NOT EXISTS gcc_world.member_payouts (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID NOT NULL,
  total            NUMERIC(12,2) NOT NULL CHECK (total > 0),
  method           VARCHAR(20) NOT NULL DEFAULT 'transferencia' CHECK (method IN ('transferencia')),
  reference        TEXT NOT NULL,
  -- El comprobante, en el Drive de la empresa (`Pagos a miembros / …`). NO va a `media_drive`: lo que está ahí
  -- se sirve sin sesión por `/api/media/<id>`, y un comprobante de transferencia es privado.
  proof_file_id    TEXT,
  proof_name       TEXT,
  proof_mime       TEXT,
  note             TEXT,
  holder_name      TEXT,
  holder_id_number VARCHAR(13),
  bank_name        TEXT,
  account_type     VARCHAR(10),
  account_last4    VARCHAR(4),
  -- El día de la transferencia (AAAA-MM-DD, el de Ecuador): un día, no un instante.
  paid_at          DATE NOT NULL,
  status           VARCHAR(10) NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'voided')),
  voided_at        TIMESTAMPTZ,
  voided_by        UUID,
  created_by       UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_payouts_user ON gcc_world.member_payouts (user_id, status, paid_at DESC);

ALTER TABLE gcc_world.member_earnings ADD COLUMN IF NOT EXISTS payout_id BIGINT REFERENCES gcc_world.member_payouts (id);
ALTER TABLE gcc_world.member_earnings ADD COLUMN IF NOT EXISTS deducted_payout_id BIGINT REFERENCES gcc_world.member_payouts (id);
CREATE INDEX IF NOT EXISTS idx_member_earnings_payout ON gcc_world.member_earnings (payout_id) WHERE payout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_member_earnings_deducted ON gcc_world.member_earnings (deducted_payout_id) WHERE deducted_payout_id IS NOT NULL;
