-- ─────────────────────────────────────────────────────────────────────────────
-- 075 · Plataformas: la organización de un cliente en un producto, con incidentes
-- ─────────────────────────────────────────────────────────────────────────────
-- Fernando, 2026-10-29: «que ese panel derecho tenga una pestaña de incidentes para que el
-- usuario pueda registrar sus incidentes al igual que se lo hace […] en un proyecto».
-- Cada inquilino vive en el esquema de su producto (reservas, pedidos…) con su propio id;
-- aquí se le da un id de la plataforma, (producto, slug) → id, para que el incidente tenga
-- dueño. Mismo criterio que la 063: la MISMA tabla de incidentes, ahora con `plataforma_id`,
-- y una fila es de exactamente un dueño.
CREATE TABLE IF NOT EXISTS gcc_world.plataformas (
  id SERIAL PRIMARY KEY,
  producto TEXT NOT NULL,
  slug TEXT NOT NULL,
  nombre TEXT NOT NULL,
  contacto_email TEXT,
  incidents_token VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (producto, slug)
);
CREATE UNIQUE INDEX IF NOT EXISTS plataformas_incidents_token_idx ON gcc_world.plataformas (incidents_token) WHERE incidents_token IS NOT NULL;

ALTER TABLE gcc_world.project_incidents ADD COLUMN IF NOT EXISTS plataforma_id INT;
CREATE INDEX IF NOT EXISTS project_incidents_plataforma_idx ON gcc_world.project_incidents (plataforma_id);
ALTER TABLE gcc_world.project_incidents DROP CONSTRAINT IF EXISTS project_incidents_de_uno;
ALTER TABLE gcc_world.project_incidents ADD CONSTRAINT project_incidents_de_uno
  CHECK (num_nonnulls(project_id, ticket_id, plataforma_id) = 1);

ALTER TABLE gcc_world.project_incident_categories ADD COLUMN IF NOT EXISTS plataforma_id INT;
CREATE INDEX IF NOT EXISTS project_incident_categories_plataforma_idx ON gcc_world.project_incident_categories (plataforma_id);
ALTER TABLE gcc_world.project_incident_categories DROP CONSTRAINT IF EXISTS project_incident_categories_de_uno;
ALTER TABLE gcc_world.project_incident_categories ADD CONSTRAINT project_incident_categories_de_uno
  CHECK (num_nonnulls(project_id, ticket_id, plataforma_id) = 1);
