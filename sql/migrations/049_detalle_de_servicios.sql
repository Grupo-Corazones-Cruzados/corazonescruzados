-- ─────────────────────────────────────────────────────────────────────────────
-- DETALLE DE SERVICIOS — el documento INFORMATIVO de una factura (Fernando, 2026-08-20)
--
-- Algunos clientes piden un papel con TODOS los conceptos de la operación, incluidos
-- los que no pasan por la factura: transferencias internacionales, remesas al exterior
-- y demás gastos que Fernando no factura ni quiere facturar.
--
-- ⚠️ NO ES UN COMPROBANTE. No se envía al SRI, no lleva clave de acceso propia ni se
-- titula «factura»: lleva el título «DETALLE DE SERVICIOS», la referencia a la factura
-- real (número y autorización, para que el cliente pueda cotejarla) y una leyenda que
-- dice literalmente que es informativo y no sustituye al comprobante. Un papel con los
-- datos del emisor, ítems y un total que se parezca a una factura es justo lo que el
-- SRI no admite emitir fuera de su esquema.
--
-- Se guarda lo que Fernando ESCRIBE (los conceptos adicionales y sus notas); el PDF se
-- arma al vuelo desde eso más los ítems reales de la factura, igual que el RIDE, para
-- que un cambio de plantilla llegue también a los documentos ya creados.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gcc_world.invoice_annexes (
  id BIGSERIAL PRIMARY KEY,
  invoice_id INT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_annexes_invoice
  ON gcc_world.invoice_annexes (invoice_id);
