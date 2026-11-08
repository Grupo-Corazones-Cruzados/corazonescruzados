-- 015 — «VER COMO ESTE USUARIO» (Fernando, 2026-11-08: «como tenemos en administrador de gcc world
-- para ver como cliente… el administrador del negocio pueda ver la app como un usuario de su
-- tenant»). Cada vista queda anotada al entrar y al salir, como `gcc_world.suplantaciones`.

CREATE TABLE IF NOT EXISTS automatizaciones.vistas_como (
  id           serial PRIMARY KEY,
  inquilino_id integer NOT NULL REFERENCES automatizaciones.inquilinos(id) ON DELETE CASCADE,
  admin_id     integer NOT NULL,
  usuario_id   integer NOT NULL,
  iniciada_en  timestamptz(3) NOT NULL DEFAULT now(),
  terminada_en timestamptz(3)
);
CREATE INDEX IF NOT EXISTS vistas_como_abiertas ON automatizaciones.vistas_como (admin_id, usuario_id) WHERE terminada_en IS NULL;
