-- GENERACIÓN DE CONTENIDO REDISEÑADO (Fernando, 2026-11-10): una sesión por idea y cuatro piezas (video final,
-- miniatura, carrusel e infografía) que se suben a Drive y se publican en todas las redes del talento.
-- Idempotente: el código lo asegura igual (`lib/centralized/contenido-local.ts`, `publicar-idea.ts`).

-- El agente pone el nombre la primera vez; uno puesto a mano lo fija.
ALTER TABLE gcc_world.gcont_contenidos ADD COLUMN IF NOT EXISTS titulo_fijado BOOLEAN NOT NULL DEFAULT false;
-- Dónde quedó cada pieza en Drive y cuándo se publicó (después de publicar, la carpeta de la Mac se borra).
ALTER TABLE gcc_world.gcont_videos ADD COLUMN IF NOT EXISTS drive JSONB;
ALTER TABLE gcc_world.gcont_videos ADD COLUMN IF NOT EXISTS publicado_en TIMESTAMPTZ;

-- Una fila por red y pieza publicada.
CREATE TABLE IF NOT EXISTS gcc_world.gcont_publicaciones_red (
  id         BIGSERIAL PRIMARY KEY,
  video_id   INT  NOT NULL REFERENCES gcc_world.gcont_videos (id) ON DELETE CASCADE,
  red        TEXT NOT NULL,
  pieza      TEXT NOT NULL,
  cuenta_id  BIGINT,
  estado     TEXT NOT NULL DEFAULT 'pendiente',
  progreso   REAL NOT NULL DEFAULT 0,
  url        TEXT,
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
