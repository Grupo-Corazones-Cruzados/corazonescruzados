-- FASE 4, PASO 3 DEL MODELO ECONÓMICO (Fernando, 2026-11-09): VARIOS EMISORES.
-- Hasta hoy había un solo emisor (GCC = GONZALEZ MUYULEMA LUIS FERNANDO) escrito en código (`SRI_CONFIG`) y una
-- sola numeración (el MAX de `invoices`). Ahora cada miembro o candidato registra su cuenta de emisor y su firma
-- electrónica; GCC es la fila con `user_id` NULL y sigue firmando con el .p12 del entorno (`SRI_P12_*`).
--
-- Solo AÑADE, salvo una cosa: la unicidad del número de factura pasa de global a POR EMISOR (dos emisores tienen
-- cada uno su 001-001-000000001). Se crea primero la nueva (que falla si ya hubiera repetidos) y luego se quita la
-- vieja. El código desplegado antes de esta migración sigue funcionando: no lee nada de aquí.
-- Idempotente: se puede correr más de una vez.

-- ── La cuenta de emisor ───────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gcc_world.sri_emisores (
  id                     BIGSERIAL PRIMARY KEY,
  -- NULL = GCC (la cuenta del SRI de Fernando). Una por usuario.
  user_id                UUID UNIQUE,
  ruc                    VARCHAR(13)  NOT NULL CHECK (ruc ~ '^[0-9]{10}001$'),
  razon_social           VARCHAR(300) NOT NULL,
  nombre_comercial       VARCHAR(300),
  dir_matriz             VARCHAR(300) NOT NULL,
  dir_establecimiento    VARCHAR(300) NOT NULL,
  estab                  CHAR(3)      NOT NULL DEFAULT '001' CHECK (estab ~ '^[0-9]{3}$' AND estab <> '000'),
  pto_emi                CHAR(3)      NOT NULL DEFAULT '001' CHECK (pto_emi ~ '^[0-9]{3}$' AND pto_emi <> '000'),
  obligado_contabilidad  BOOLEAN      NOT NULL DEFAULT false,
  regimen                VARCHAR(25)  NOT NULL CHECK (regimen IN ('rimpe_negocio_popular', 'rimpe_emprendedor', 'general')),
  -- La leyenda literal de la Ficha Técnica; la elige el código según el régimen (`lib/integrations/sri/emisor.ts`).
  leyenda_rimpe          VARCHAR(60),
  -- Nº de resolución de agente de retención / contribuyente especial, si los tiene.
  agente_retencion       VARCHAR(8),
  contribuyente_especial VARCHAR(13),
  -- 1 = pruebas (celcer), 2 = producción.
  ambiente               CHAR(1)      NOT NULL DEFAULT '1' CHECK (ambiente IN ('1', '2')),
  cobra_iva              BOOLEAN      NOT NULL DEFAULT false,
  -- `codigoPorcentaje` del SRI para la tarifa que cobra: 0 = 0 %, 4 = 15 %, 5 = 5 %.
  tarifa_iva             VARCHAR(2)   NOT NULL DEFAULT '0' CHECK (tarifa_iva IN ('0', '4', '5')),
  -- GCC: el .p12 sale de SRI_P12_BASE64 / SRI_P12_PATH + SRI_P12_PASSWORD, no de la base.
  firma_desde_entorno    BOOLEAN      NOT NULL DEFAULT false,
  -- El .p12 (base64) y su clave, CIFRADOS con `lib/cifrado.ts` (contexto `sri_emisores:<id>:p12` / `:p12_password`).
  -- Nunca salen al navegador; solo los descifra el firmador.
  p12_enc                TEXT,
  p12_password_enc       TEXT,
  p12_vence              DATE,
  p12_titular            TEXT,
  -- La cédula o RUC que trae el certificado, y si coincide con `ruc` (NULL = el certificado no la trae).
  p12_identificacion     VARCHAR(13),
  p12_ruc_coincide       BOOLEAN,
  p12_actualizada        TIMESTAMPTZ,
  -- El vencimiento del que ya se avisó (un aviso por certificado).
  p12_aviso_vence        DATE,
  estado                 VARCHAR(12)  NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'en_pruebas', 'activo', 'suspendido')),
  activo_desde           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by             UUID
);
-- Una sola fila de GCC.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sri_emisores_gcc ON gcc_world.sri_emisores ((user_id IS NULL)) WHERE user_id IS NULL;

-- GCC, reproduciendo EXACTAMENTE lo que tenía `SRI_CONFIG` el 2026-11-09.
INSERT INTO gcc_world.sri_emisores
  (user_id, ruc, razon_social, nombre_comercial, dir_matriz, dir_establecimiento, estab, pto_emi,
   obligado_contabilidad, regimen, leyenda_rimpe, agente_retencion, contribuyente_especial, ambiente,
   cobra_iva, tarifa_iva, firma_desde_entorno, estado, activo_desde)
SELECT NULL, '0930095922001', 'GONZALEZ MUYULEMA LUIS FERNANDO', 'GRUPO CORAZONES CRUZADOS',
       'Barrio 7 Lagos, Calle Tabacundo #12, Guasmo Central', 'Barrio 7 Lagos, Calle Tabacundo #12, Guasmo Central',
       '001', '001', false, 'rimpe_negocio_popular', 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE', NULL, NULL, '2',
       false, '0', true, 'activo', COALESCE((SELECT MIN(created_at) FROM gcc_world.invoices), NOW())
WHERE NOT EXISTS (SELECT 1 FROM gcc_world.sri_emisores WHERE user_id IS NULL);

-- Quién tocó la cuenta de emisor o su firma, y cuándo. NUNCA el .p12 ni su clave.
CREATE TABLE IF NOT EXISTS gcc_world.sri_emisor_log (
  id             BIGSERIAL PRIMARY KEY,
  emisor_id      BIGINT      NOT NULL REFERENCES gcc_world.sri_emisores (id),
  action         VARCHAR(12) NOT NULL CHECK (action IN ('created', 'updated', 'firma', 'estado')),
  changed_fields TEXT[]      NOT NULL DEFAULT '{}',
  -- Para 'firma': titular y vencimiento del certificado nuevo; para 'estado': de cuál a cuál.
  detalle        TEXT,
  actor_user_id  UUID        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sri_emisor_log_emisor ON gcc_world.sri_emisor_log (emisor_id, created_at DESC);

-- ── La numeración, por emisor, establecimiento, punto de emisión y tipo de comprobante ─────────────────────────
-- `ultimo` = el último número usado. El código toma GREATEST(ultimo, MAX de lo emitido) + 1 bajo `FOR UPDATE`.
CREATE TABLE IF NOT EXISTS gcc_world.sri_secuenciales (
  emisor_id  BIGINT      NOT NULL REFERENCES gcc_world.sri_emisores (id),
  estab      CHAR(3)     NOT NULL,
  pto_emi    CHAR(3)     NOT NULL,
  -- 01 = factura, 04 = nota de crédito.
  tipo_doc   CHAR(2)     NOT NULL CHECK (tipo_doc IN ('01', '04')),
  ultimo     INTEGER     NOT NULL DEFAULT 0 CHECK (ultimo >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (emisor_id, estab, pto_emi, tipo_doc)
);

-- GCC sigue donde va. Facturas: el MAX de hoy, nunca por debajo de 22 (la primera de este sistema fue la 23; las
-- anteriores se emitieron fuera). Notas de crédito: viven en `invoices.sri_response.credit_note.numero`
-- («NC-001-001-000000010»), la misma consulta que usaba la ruta de anular.
INSERT INTO gcc_world.sri_secuenciales (emisor_id, estab, pto_emi, tipo_doc, ultimo)
SELECT e.id, '001', '001', '01',
       GREATEST(22, COALESCE((SELECT MAX(CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER))
                                FROM gcc_world.invoices WHERE invoice_number LIKE '001-001-%'), 0))
  FROM gcc_world.sri_emisores e WHERE e.user_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO gcc_world.sri_secuenciales (emisor_id, estab, pto_emi, tipo_doc, ultimo)
SELECT e.id, '001', '001', '04',
       COALESCE((SELECT MAX(CAST(SPLIT_PART((sri_response::json->'credit_note'->>'numero'), '-', 4) AS INTEGER))
                   FROM gcc_world.invoices
                  WHERE sri_response IS NOT NULL AND sri_response::text LIKE '%credit_note%'), 0)
  FROM gcc_world.sri_emisores e WHERE e.user_id IS NULL
ON CONFLICT DO NOTHING;

-- ── Cada factura sabe quién la emitió ─────────────────────────────────────────────────────────────────────────
-- NULL = GCC (todas las anteriores a esta migración). Sin rellenar aquí: el código toma NULL como GCC.
ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS emisor_id BIGINT REFERENCES gcc_world.sri_emisores (id);
CREATE INDEX IF NOT EXISTS idx_invoices_emisor ON gcc_world.invoices (emisor_id) WHERE emisor_id IS NOT NULL;

-- El número de factura es único POR EMISOR, no en toda la plataforma.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_emisor_numero ON gcc_world.invoices (ruc_emisor, invoice_number);
ALTER TABLE gcc_world.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
