-- Fotos y videos de Proyectos y Productos en el Google Drive de la empresa (2026-10-13).
--
-- Decisión de Fernando: todas las fotos y videos del módulo de Proyectos y de los productos
-- viven en el Drive de lfgonzalezm0@grupocc.org (carpeta «GCC World / Media»), y salen de la
-- base (base64 / bytea) y de Cloudinary. Cada archivo se puede renombrar desde la plataforma y
-- el nombre cambia también en Drive.
--
-- En las filas de origen (projects.images, "Incident".images, destrezas.imagen_url…) queda
-- la URL `/api/media/<file_id>`. Esta tabla es el REGISTRO: la ruta /api/media solo sirve
-- archivos que estén aquí, nunca un id cualquiera del Drive de la empresa.

CREATE TABLE IF NOT EXISTS gcc_world.media_drive (
  file_id        TEXT PRIMARY KEY,                -- id de Drive (no cambia al renombrar)
  nombre         TEXT NOT NULL,                   -- el de Drive; la fuente de verdad es Drive
  mime           TEXT NOT NULL,
  tamano         BIGINT NOT NULL,
  md5            TEXT,                            -- md5Checksum de Drive, comprobado al subir
  modulo         TEXT NOT NULL,                   -- proyecto_foto | proyecto_video | incidencia | destreza
  referencia     TEXT NOT NULL,                   -- id del proyecto / incidencia / destreza
  origen         TEXT,                            -- de dónde vino al migrar (base64, cloudinary:<public_id>…)
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  borrado_en     TIMESTAMPTZ                      -- quitado de la plataforma (y a la papelera de Drive)
);

CREATE INDEX IF NOT EXISTS media_drive_ref_idx ON gcc_world.media_drive (modulo, referencia) WHERE borrado_en IS NULL;

-- El video generado de un proyecto deja de ir en `video_data` (bytea).
ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS video_file_id TEXT;
