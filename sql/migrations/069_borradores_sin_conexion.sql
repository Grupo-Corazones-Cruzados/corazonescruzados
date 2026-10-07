-- ─────────────────────────────────────────────────────────────────────────────
-- 069 · Borradores de tickets y proyectos que se crean sin conexión (Fernando, 2026-10-07)
-- ─────────────────────────────────────────────────────────────────────────────
-- «Los tickets y proyectos pueden funcionar sin conexión mientras su estado sea borrador;
-- para llevarlos al siguiente estado deben tener conexión.» Los tickets estrenan el estado
-- 'draft' (no hay CHECK sobre tickets.status: no hace falta tocarlo); los proyectos ya lo
-- tenían.
--
-- `offline_id`: el identificador que el DISPOSITIVO le pone a lo que crea sin red. Al volver la
-- conexión se sube con él, y si la subida se repite (respuesta perdida, dos pestañas…) el
-- servidor reconoce el mismo borrador en vez de crear otro. Único por tabla.
--
-- `draft_client_email`: un borrador puede llevar el cliente solo por correo. Hasta enviarlo NO
-- se crea la ficha del cliente ni se le invita: eso es hablarle al cliente, y un borrador
-- no habla con nadie.
ALTER TABLE gcc_world.tickets  ADD COLUMN IF NOT EXISTS offline_id UUID;
ALTER TABLE gcc_world.tickets  ADD COLUMN IF NOT EXISTS draft_client_email TEXT;
ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS offline_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS tickets_offline_id_uq  ON gcc_world.tickets  (offline_id) WHERE offline_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS projects_offline_id_uq ON gcc_world.projects (offline_id) WHERE offline_id IS NOT NULL;
