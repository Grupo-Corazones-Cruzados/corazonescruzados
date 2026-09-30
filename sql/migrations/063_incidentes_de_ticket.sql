-- ─────────────────────────────────────────────────────────────────────────────
-- 063 · Incidentes también en TICKETS (Fernando, 2026-09-30)
-- ─────────────────────────────────────────────────────────────────────────────
-- «Me interesa también que agregues las pestañas de Propiedades e Incidentes» en el detalle
-- del ticket. Mismo criterio que la 062 con las etapas: la MISMA tabla, con `ticket_id`,
-- y una fila es de un proyecto O de un ticket, nunca de los dos. Así el portal público, el
-- componente y las rutas son uno solo para los dos orígenes.
ALTER TABLE gcc_world.project_incidents ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE gcc_world.project_incidents ADD COLUMN IF NOT EXISTS ticket_id INT;
CREATE INDEX IF NOT EXISTS project_incidents_ticket_idx ON gcc_world.project_incidents (ticket_id);
ALTER TABLE gcc_world.project_incidents DROP CONSTRAINT IF EXISTS project_incidents_de_uno;
ALTER TABLE gcc_world.project_incidents ADD CONSTRAINT project_incidents_de_uno
  CHECK ((project_id IS NULL) <> (ticket_id IS NULL));

ALTER TABLE gcc_world.project_incident_categories ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE gcc_world.project_incident_categories ADD COLUMN IF NOT EXISTS ticket_id INT;
CREATE INDEX IF NOT EXISTS project_incident_categories_ticket_idx ON gcc_world.project_incident_categories (ticket_id);
ALTER TABLE gcc_world.project_incident_categories DROP CONSTRAINT IF EXISTS project_incident_categories_de_uno;
ALTER TABLE gcc_world.project_incident_categories ADD CONSTRAINT project_incident_categories_de_uno
  CHECK ((project_id IS NULL) <> (ticket_id IS NULL));

-- El enlace del portal público del ticket (revocable, como el del proyecto).
ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS incidents_token VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS tickets_incidents_token_idx ON gcc_world.tickets (incidents_token) WHERE incidents_token IS NOT NULL;
