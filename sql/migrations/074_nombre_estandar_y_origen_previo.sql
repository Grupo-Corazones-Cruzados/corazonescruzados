-- ─────────────────────────────────────────────────────────────────────────────
-- 074 · Cobro ⇒ completado y nombre estándar (Fernando, 2026-10-29)
-- ─────────────────────────────────────────────────────────────────────────────
-- Se aplicaron a mano el mismo día; aquí quedan escritas (todas IF NOT EXISTS).
-- · invoices.origen_estado_previo: el estado que tenía el ticket/proyecto antes de que el
--   cobro lo completara; anular la factura se lo devuelve (lib/pagos/completar-origen.ts).
-- · titulo_original / descripcion_original / nombre_estandar_*: el renombrado con IA al quedar
--   pagada la factura (lib/pagos/nombre-estandar.ts).
ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS origen_estado_previo VARCHAR(30);

ALTER TABLE gcc_world.tickets
  ADD COLUMN IF NOT EXISTS titulo_original TEXT,
  ADD COLUMN IF NOT EXISTS descripcion_original TEXT,
  ADD COLUMN IF NOT EXISTS nombre_estandar_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nombre_estandar_pendiente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nombre_estandar_error TEXT;
CREATE INDEX IF NOT EXISTS tickets_nombre_pendiente_idx ON gcc_world.tickets (id) WHERE nombre_estandar_pendiente;

ALTER TABLE gcc_world.projects
  ADD COLUMN IF NOT EXISTS titulo_original TEXT,
  ADD COLUMN IF NOT EXISTS descripcion_original TEXT,
  ADD COLUMN IF NOT EXISTS nombre_estandar_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nombre_estandar_pendiente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nombre_estandar_error TEXT;
CREATE INDEX IF NOT EXISTS projects_nombre_pendiente_idx ON gcc_world.projects (id) WHERE nombre_estandar_pendiente;
