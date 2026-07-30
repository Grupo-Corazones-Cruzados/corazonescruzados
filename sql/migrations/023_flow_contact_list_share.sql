-- 023 — Enlace público para llenar una lista de contactos (2026-07-30)
--
-- Contexto: en Automatizaciones → Email masivo, las listas de contactos solo se
-- podían llenar desde el dashboard (a mano o importando un Excel), y eso obliga a
-- que alguien con cuenta transcriba lo que le pasan por fuera.
--
-- Con esto una lista puede tener un ENLACE con token: se comparte con una persona
-- externa (sin cuenta) y esa persona agrega, edita o quita contactos de ESA lista
-- desde una página pública. El token es la única credencial, así que:
--   * es aleatorio de 32 bytes (no adivinable),
--   * se puede REVOCAR (share_token = NULL) sin tocar la lista ni sus contactos,
--   * al revocar y volver a compartir se genera uno nuevo (el viejo muere).
--
-- `share_created_at` queda para saber desde cuándo está abierto el enlace.

ALTER TABLE gcc_world.flow_contact_lists
  ADD COLUMN IF NOT EXISTS share_token      TEXT,
  ADD COLUMN IF NOT EXISTS share_created_at TIMESTAMPTZ;

-- Un token no puede repetirse entre listas (los NULL no cuentan: las listas sin
-- enlace conviven sin problema).
CREATE UNIQUE INDEX IF NOT EXISTS flow_contact_lists_share_token_key
  ON gcc_world.flow_contact_lists (share_token)
  WHERE share_token IS NOT NULL;

-- Trazabilidad de lo que entra por el enlace público: distingue los contactos que
-- agregó una persona externa de los que puso un miembro desde el dashboard.
ALTER TABLE gcc_world.flow_contacts
  ADD COLUMN IF NOT EXISTS added_via_share BOOLEAN NOT NULL DEFAULT FALSE;
