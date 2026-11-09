-- FASE 4, PASO 4 DEL MODELO ECONÓMICO (Fernando, 2026-11-09): FACTURAS AUTOMÁTICAS POR MIEMBRO TRAS CADA COBRO.
-- Al confirmarse un pago, lo que es de un miembro con cuenta de emisor habilitada sale en SU factura, firmada con su
-- firma electrónica; lo demás sigue en la de GCC como hasta hoy (`lib/pagos/facturas-del-cobro.ts`).
--
-- Un cobro puede dar ahora VARIAS facturas: `payment_intent_invoices` las enlaza y guarda su estado de emisión,
-- que reintenta el cron frecuente (`/api/pagos/cron/facturas`). `payment_intents.invoice_id` sigue apuntando a la
-- de GCC (o a la primera, si no hay de GCC), para el código que ya lo lee.
--
-- AMBIENTE DE PRUEBAS: un emisor `en_pruebas` emite en el ambiente 1 del SRI. Su numeración NO se mezcla con la de
-- producción: el contador lleva el ambiente en la clave y la factura guarda el suyo (`invoices.sri_ambiente`, NULL =
-- producción, que es lo que son todas las anteriores). Por eso la unicidad del número pasa a ser por
-- (emisor, número, ambiente): se crea la nueva antes de quitar la vieja, que es más estricta.
--
-- Sin esta migración el código hace exactamente lo de antes (una factura de GCC por cobro). Idempotente.

-- ── Las facturas de cada cobro ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gcc_world.payment_intent_invoices (
  id                BIGSERIAL PRIMARY KEY,
  payment_intent_id BIGINT       NOT NULL,
  emisor_id         BIGINT       NOT NULL REFERENCES gcc_world.sri_emisores (id),
  -- La ficha del miembro que factura; NULL = GCC.
  member_id         BIGINT,
  -- NULL mientras la factura no se ha creado (se crea en el acto; si falla, la crea el reintento).
  invoice_id        BIGINT,
  -- Lo que suma esta factura (sus líneas). La suma de las de un cobro es lo cobrado.
  amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- 1 = pruebas, 2 = producción (el del emisor al planificarse; la factura no cambia de ambiente después).
  ambiente          CHAR(1)      NOT NULL DEFAULT '2' CHECK (ambiente IN ('1', '2')),
  --  pendiente  → falta crearla o que el SRI la autorice: la reintenta el cron.
  --  autorizada → el SRI la autorizó y se cerró lo que cuelga de ella (pagada, correo, mes, origen).
  --  rechazada  → el SRI dio un veredicto en contra: no se reintenta sola (se corrige y se reenvía a mano).
  --  fallida    → agotó los reintentos.
  --  manual     → la factura única de GCC de un cobro sin miembros: se lleva como siempre, sin reintento automático.
  --  reasignada → no se pudo crear con el emisor del miembro y sus líneas pasaron a la de GCC.
  estado            VARCHAR(12)  NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'autorizada', 'rechazada', 'fallida', 'manual', 'reasignada')),
  intentos          INT          NOT NULL DEFAULT 0,
  ultimo_error      TEXT,
  siguiente_intento TIMESTAMPTZ,
  -- Quien la está procesando la marca; pasados 15 min se da por atascada (gcc-after-muere-con-el-despliegue).
  procesando_desde  TIMESTAMPTZ,
  -- Lo necesario para crearla y para cerrar lo que cuelga de ella sin volver a calcular nada: sus líneas, sus
  -- requerimientos y etapas, el comprador y los textos del correo.
  contexto          JSONB,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Idempotente por (cobro, emisor): una factura por emisor y cobro.
  CONSTRAINT payment_intent_invoices_intent_emisor_key UNIQUE (payment_intent_id, emisor_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intent_invoices_invoice
  ON gcc_world.payment_intent_invoices (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_intent_invoices_pendientes
  ON gcc_world.payment_intent_invoices (siguiente_intento) WHERE estado = 'pendiente';

-- Los cobros ya facturados: su única factura, de GCC. Sin esto la tabla solo sabría de los cobros nuevos.
INSERT INTO gcc_world.payment_intent_invoices
  (payment_intent_id, emisor_id, member_id, invoice_id, amount, ambiente, estado, created_at, updated_at)
SELECT pi.id, COALESCE(i.emisor_id, e.id), NULL, pi.invoice_id, COALESCE(i.total, pi.charge_amount, 0), '2',
       CASE WHEN i.sri_status = 'authorized' THEN 'autorizada' ELSE 'manual' END, pi.paid_at, NOW()
  FROM gcc_world.payment_intents pi
  JOIN gcc_world.invoices i ON i.id = pi.invoice_id
  CROSS JOIN (SELECT id FROM gcc_world.sri_emisores WHERE user_id IS NULL LIMIT 1) e
 WHERE pi.invoice_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── El ambiente de cada factura ────────────────────────────────────────────────────────────────────────────────
-- NULL = producción ('2'). Solo se escribe '1' (las de un emisor en pruebas).
ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS sri_ambiente CHAR(1);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'gcc_world.invoices'::regclass AND conname = 'invoices_sri_ambiente_check') THEN
    ALTER TABLE gcc_world.invoices ADD CONSTRAINT invoices_sri_ambiente_check CHECK (sri_ambiente IS NULL OR sri_ambiente IN ('1', '2'));
  END IF;
END $$;

-- El número es único por emisor Y ambiente: la 001-001-000000001 de pruebas no choca con la de producción.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_emisor_numero_ambiente
  ON gcc_world.invoices (ruc_emisor, invoice_number, (COALESCE(sri_ambiente, '2')));
DROP INDEX IF EXISTS gcc_world.uq_invoices_emisor_numero;

-- ── La numeración, también por ambiente ────────────────────────────────────────────────────────────────────────
-- Las filas que ya existen son de producción (las de GCC). La clave primaria pasa a incluir el ambiente.
ALTER TABLE gcc_world.sri_secuenciales ADD COLUMN IF NOT EXISTS ambiente CHAR(1) NOT NULL DEFAULT '2';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'gcc_world.sri_secuenciales'::regclass AND conname = 'sri_secuenciales_ambiente_check') THEN
    ALTER TABLE gcc_world.sri_secuenciales ADD CONSTRAINT sri_secuenciales_ambiente_check CHECK (ambiente IN ('1', '2'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'gcc_world.sri_secuenciales'::regclass AND conname = 'sri_secuenciales_pkey'
       AND pg_get_constraintdef(oid) LIKE '%ambiente%'
  ) THEN
    ALTER TABLE gcc_world.sri_secuenciales DROP CONSTRAINT IF EXISTS sri_secuenciales_pkey;
    ALTER TABLE gcc_world.sri_secuenciales ADD CONSTRAINT sri_secuenciales_pkey PRIMARY KEY (emisor_id, estab, pto_emi, tipo_doc, ambiente);
  END IF;
END $$;
