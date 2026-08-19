-- ─────────────────────────────────────────────────────────────────────────────
-- FACTURACIÓN POR ETAPAS (Fernando + su contadora, 2026-08-19)
--
-- Un proyecto no se factura cuando se cobra, sino cuando se entrega cada fase:
--
--   LRTI Art. 61: «En las prestaciones de servicios, en el momento en que se preste
--   efectivamente el servicio, o en el momento del pago total o parcial del precio…
--   a elección del contribuyente». Y para trabajos por fases: «En el caso de
--   prestaciones de servicios por avance de obra o etapas, el hecho generador del
--   impuesto se verificará con la entrega de cada certificado de avance de obra o
--   etapa, hecho por el cual se debe emitir obligatoriamente el respectivo
--   comprobante de venta».
--
--   Rgto. de Comprobantes de Venta, Art. 17 lit. e): «En el caso de los contratos…
--   por etapas, avance de obras o trabajos… el comprobante de venta se entregará al
--   cumplirse las condiciones para cada período, fase o etapa».
--
-- La etapa es el REQUERIMIENTO del proyecto (ya tiene título, importe y fecha de
-- entrega). Cada una se factura UNA sola vez: queda enlazada a su factura y la
-- factura del resto del proyecto solo arrastra las que falten. Una factura anulada
-- libera sus etapas (las consultas filtran por `status <> 'cancelled'`).
--
-- El dinero recibido por adelantado (el clásico 25% a la firma) NO es una factura:
-- se registra como COBRO en `project_payments`, que existía sin usarse.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enlace factura ↔ etapa.
CREATE TABLE IF NOT EXISTS gcc_world.invoice_requirements (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL,
  requirement_id BIGINT NOT NULL,
  project_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_requirements_unique
  ON gcc_world.invoice_requirements (invoice_id, requirement_id);
CREATE INDEX IF NOT EXISTS idx_invoice_requirements_req
  ON gcc_world.invoice_requirements (requirement_id);

-- 2. Cobros del proyecto. La tabla venía de un diseño anterior que exigía comprobante
--    de pago y nunca se usó (0 filas): el respaldo pasa a ser opcional.
CREATE TABLE IF NOT EXISTS gcc_world.project_payments (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  project_id BIGINT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  proof_url TEXT,
  status VARCHAR(20) DEFAULT 'confirmed',
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  notes TEXT
);
ALTER TABLE gcc_world.project_payments ALTER COLUMN proof_url DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_payments_project
  ON gcc_world.project_payments (project_id);

-- 3. El descuento por línea se guardaba en ninguna parte: el XML lo enviaba al SRI
--    pero la base guardaba el importe SIN descontar, así que el RIDE y el saldo del
--    proyecto contradecían al comprobante autorizado.
ALTER TABLE gcc_world.invoice_items_sri ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) DEFAULT 0;

-- 4. Histórico: hasta hoy, facturar un proyecto era facturarlo ENTERO (el emisor
--    tomaba todos sus requerimientos). Esas facturas se enlazan con todas las etapas
--    de su proyecto para que no vuelvan a ofrecerse como facturables.
--
--    Solo se hace cuando lo ya facturado cubre el total de las etapas (99% o más).
--    Si cubre menos, el proyecto se facturó en partes y no se puede adivinar cuál
--    fue cuál: se deja sin enlazar y la pantalla lo avisa en ámbar antes de emitir.
INSERT INTO gcc_world.invoice_requirements (invoice_id, requirement_id, project_id)
SELECT f.invoice_id, r.id, f.project_id
  FROM (
    SELECT p.id AS project_id,
           (SELECT i.id
              FROM gcc_world.invoices i
             WHERE i.status <> 'cancelled'
               AND (i.project_id = p.id
                    OR i.id IN (SELECT ip.invoice_id FROM gcc_world.invoice_projects ip WHERE ip.project_id = p.id::text))
             ORDER BY i.created_at DESC
             LIMIT 1) AS invoice_id,
           (SELECT COALESCE(SUM(i.total), 0)
              FROM gcc_world.invoices i
             WHERE i.status <> 'cancelled'
               AND (i.project_id = p.id
                    OR i.id IN (SELECT ip.invoice_id FROM gcc_world.invoice_projects ip WHERE ip.project_id = p.id::text))) AS facturado,
           (SELECT COALESCE(SUM(monto), 0) FROM (
              SELECT COALESCE(SUM(COALESCE(ra.member_cost, ra.proposed_cost)), r2.cost, 0) AS monto
                FROM gcc_world.project_requirements r2
                LEFT JOIN gcc_world.requirement_assignments ra
                       ON ra.requirement_id = r2.id AND ra.status = 'accepted'
               WHERE r2.project_id = p.id
               GROUP BY r2.id, r2.cost
            ) etapas) AS total_etapas
      FROM gcc_world.projects p
  ) f
  JOIN gcc_world.project_requirements r ON r.project_id = f.project_id
 WHERE f.invoice_id IS NOT NULL
   AND f.total_etapas > 0
   AND f.facturado >= f.total_etapas * 0.99
ON CONFLICT DO NOTHING;
