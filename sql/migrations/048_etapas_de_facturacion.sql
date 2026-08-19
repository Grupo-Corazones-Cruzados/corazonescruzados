-- ─────────────────────────────────────────────────────────────────────────────
-- LAS ETAPAS SON DEL ACUERDO CON EL CLIENTE, NO LOS REQUERIMIENTOS (Fernando, 2026-08-19)
--
-- Corrección al modelo de la migración 047. Allí la «etapa» era el requerimiento del
-- proyecto, y eso estaba mal: el requerimiento es TRABAJO INTERNO (lo que se reparte
-- entre los miembros), mientras que la etapa es el TRAMO COMERCIAL que se pacta con el
-- cliente («50% al empezar, 50% al entregar»). Son dos cosas distintas y no coinciden.
--
-- Así que un proyecto puede definir su PLAN DE ETAPAS: n tramos con nombre e importe,
-- donde el ÚLTIMO se calcula solo (el total del proyecto menos los anteriores), que es
-- como Fernando las acuerda. Si el proyecto tiene plan, se factura por etapas y ya no
-- por el detalle de requerimientos; si no lo tiene, todo sigue como estaba.
--
-- Cada etapa se factura UNA sola vez (`invoice_id`). Una factura anulada la libera,
-- porque las consultas ignoran las facturas con `status = 'cancelled'`.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gcc_world.project_stages (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL,
  name VARCHAR(200) NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  invoice_id INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_stages_project
  ON gcc_world.project_stages (project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_stages_invoice
  ON gcc_world.project_stages (invoice_id);
