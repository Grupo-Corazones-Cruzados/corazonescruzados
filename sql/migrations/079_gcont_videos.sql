-- GENERACIÓN DE CONTENIDO · VIDEOS. Una idea puede tener varios videos grabados y cada video lleva
-- su propia sesión de Claude Code en la Mac. El archivo vive en ~/Movies/GCC-Edicion/<carpeta>; aquí
-- solo está la ficha. Se sube de uno en uno.
CREATE TABLE IF NOT EXISTS gcc_world.gcont_videos (
  id           SERIAL PRIMARY KEY,
  contenido_id INT NOT NULL REFERENCES gcc_world.gcont_contenidos(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,                     -- el nombre del archivo que se subió
  tamano       BIGINT NOT NULL,                   -- para reanudar solo con el mismo archivo
  carpeta      TEXT UNIQUE,                       -- video-<id>-<tema>, dentro de GCC-Edicion
  sesion_id    TEXT,                              -- nula mientras se sube
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gcont_videos_contenido_idx ON gcc_world.gcont_videos(contenido_id);
