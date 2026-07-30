-- 024 — Una campaña puede usar VARIAS listas + más datos por contacto (2026-07-30)
--
-- Contexto: `flow_campaigns.contact_list_id` ataba una campaña a UNA sola lista. El módulo
-- de Automatizaciones pasa a una pantalla donde se eligen con casillas las listas que
-- entran en la campaña, así que la relación es N:M.
--
-- La columna vieja NO se borra: las campañas ya enviadas la usan y sirve de respaldo si
-- algo quedara sin migrar. La fuente de verdad a partir de aquí es `flow_campaign_lists`.
--
-- Además el contacto gana `position` (el "puesto") y se aprovecha `phone`, que ya existía
-- pero solo lo llenaba el flujo de WhatsApp. Los cuatro campos (nombre, correo, teléfono,
-- puesto) son los que se pueden insertar como VARIABLES en el correo de la campaña.

-- ── Campaña ↔ listas (N:M) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gcc_world.flow_campaign_lists (
  campaign_id INT NOT NULL REFERENCES gcc_world.flow_campaigns(id) ON DELETE CASCADE,
  list_id     INT NOT NULL REFERENCES gcc_world.flow_contact_lists(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, list_id)
);

-- Para resolver "¿qué campañas usan esta lista?" sin escanear la tabla.
CREATE INDEX IF NOT EXISTS flow_campaign_lists_list_idx
  ON gcc_world.flow_campaign_lists (list_id);

-- Backfill: cada campaña que ya apuntaba a una lista queda asociada a ella.
INSERT INTO gcc_world.flow_campaign_lists (campaign_id, list_id)
SELECT c.id, c.contact_list_id
  FROM gcc_world.flow_campaigns c
 WHERE c.contact_list_id IS NOT NULL
ON CONFLICT (campaign_id, list_id) DO NOTHING;

-- ── Datos del contacto ─────────────────────────────────────────────────────────
-- `position` = puesto/cargo. Nombre en inglés por coherencia con el resto de columnas.
ALTER TABLE gcc_world.flow_contacts
  ADD COLUMN IF NOT EXISTS position VARCHAR(160);

-- El teléfono existía con 30 caracteres pensando solo en WhatsApp; se deja igual porque
-- sobra para un E.164 con separadores.
