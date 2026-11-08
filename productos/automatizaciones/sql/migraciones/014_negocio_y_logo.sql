-- 014 — «MARCA» PASA A «NEGOCIO» (Fernando, 2026-11-08).
--
-- «que en marca quitemos eso de poder escoger el tema o color de la app, y que solo puedan
-- llenar datos de su negocio, por ejemplo datos de facturación, o datos de contacto» y
-- «permite subir un logo como archivo y no deje que se pueda subir como url».
--
-- · Datos de facturación en el inquilino. Los de contacto ya existían (contacto_*).
-- · El logo se guarda en la BASE, en su propia tabla: Cloudinary no está en producción, y en
--   `inquilinos` haría que cada petición arrastrara la imagen (el contexto lee la fila entera).
-- · `logo_version` va en la URL del logo (`/<cliente>/logo?v=N`): el navegador puede guardarlo
--   para siempre y aun así ve el nuevo en cuanto cambia.
-- · `color_acento` y `tema` se quedan sin uso (el producto tiene un solo tema); no se borran.

ALTER TABLE automatizaciones.inquilinos
  ADD COLUMN IF NOT EXISTS razon_social       text,
  ADD COLUMN IF NOT EXISTS identificacion     varchar(20),
  ADD COLUMN IF NOT EXISTS direccion          text,
  ADD COLUMN IF NOT EXISTS correo_facturacion text,
  ADD COLUMN IF NOT EXISTS logo_version       integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS automatizaciones.logos (
  inquilino_id   integer PRIMARY KEY REFERENCES automatizaciones.inquilinos(id) ON DELETE CASCADE,
  datos          bytea NOT NULL,
  tipo           varchar(40) NOT NULL,
  actualizado_en timestamptz(3) NOT NULL DEFAULT now()
);
