-- GENERACIÓN DE CONTENIDO · PUBLICAR EN REDES. Las cuentas se conectan una vez por canal o página, porque
-- hay dos marcas, y cada publicación queda registrada. Hoy solo YouTube; `red` deja sitio a las demás.
CREATE TABLE IF NOT EXISTS gcc_world.gcont_redes_cuentas (
  id             SERIAL PRIMARY KEY,
  red            TEXT NOT NULL,                    -- 'youtube'
  externo_id     TEXT NOT NULL,                    -- id del canal en la red
  nombre         TEXT NOT NULL,
  token_cifrado  TEXT NOT NULL,                    -- refresh token, cifrado con lib/cifrado.ts
  estado         TEXT NOT NULL DEFAULT 'activa',   -- activa | reconectar
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (red, externo_id)
);
CREATE TABLE IF NOT EXISTS gcc_world.gcont_publicaciones (
  id           SERIAL PRIMARY KEY,
  video_id     INT NOT NULL REFERENCES gcc_world.gcont_videos(id) ON DELETE CASCADE,
  cuenta_id    INT NOT NULL REFERENCES gcc_world.gcont_redes_cuentas(id),
  titulo       TEXT NOT NULL,
  descripcion  TEXT NOT NULL DEFAULT '',
  privacidad   TEXT NOT NULL,                      -- private | unlisted | public
  programada   TIMESTAMPTZ,
  estado       TEXT NOT NULL DEFAULT 'subiendo',   -- subiendo | publicada | error
  progreso     REAL NOT NULL DEFAULT 0,
  url          TEXT,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gcont_publicaciones_video_idx ON gcc_world.gcont_publicaciones(video_id);
