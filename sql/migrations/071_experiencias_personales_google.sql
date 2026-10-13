-- ─────────────────────────────────────────────────────────────────────────────
-- 071 · Conexión con Google por usuario + Experiencias personales (2026-10-13)
-- ─────────────────────────────────────────────────────────────────────────────
-- Una experiencia PERSONAL la crea el propio usuario (miembro o candidato) y NO
-- toca su perfil: no tiene tareas, ni plazas, ni ciclo de vida, y por eso vive en
-- tablas propias y nunca en `gs_*` (que sí puntúan en getSubjectsProfileScores).
--
-- Los ARCHIVOS no tienen tabla: viven en el Google Drive del usuario y se listan en
-- vivo. Drive es la fuente de verdad; aquí solo se guardan los ids de carpeta.
--   GCC World / Experiencias / <experiencia> / <evento>
-- Un archivo suelto en la carpeta de la experiencia = «sin evento».

-- Una conexión por usuario. Los tokens van CIFRADOS (lib/cifrado.ts, AAD por usuario).
CREATE TABLE IF NOT EXISTS gcc_world.google_conexiones (
  user_id                uuid PRIMARY KEY REFERENCES gcc_world.users(id) ON DELETE CASCADE,
  google_email           text NOT NULL,
  scopes                 text[] NOT NULL DEFAULT '{}',
  refresh_token_cifrado  text NOT NULL,
  access_token_cifrado   text,
  access_expira          timestamptz,
  -- 'activa' | 'revocada' (Google devolvió invalid_grant: hay que reconectar)
  estado                 text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'revocada')),
  carpeta_raiz_id        text,   -- «GCC World / Experiencias» en su Drive
  conectada_en           timestamptz NOT NULL DEFAULT now(),
  actualizada_en         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gcc_world.exp_personales (
  id               bigserial PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES gcc_world.users(id) ON DELETE CASCADE,
  nombre           text NOT NULL CHECK (length(btrim(nombre)) > 0),
  descripcion      text,
  drive_folder_id  text NOT NULL,
  creada_en        timestamptz NOT NULL DEFAULT now(),
  actualizada_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exp_personales_user_idx ON gcc_world.exp_personales (user_id, creada_en DESC);

-- El «evento» es la categoría de los archivos dentro de una experiencia.
-- Cada fila se guarda sola (nunca borrar-y-reinsertar), así que la cascada desde la
-- experiencia es segura.
CREATE TABLE IF NOT EXISTS gcc_world.exp_personales_eventos (
  id               bigserial PRIMARY KEY,
  experiencia_id   bigint NOT NULL REFERENCES gcc_world.exp_personales(id) ON DELETE CASCADE,
  nombre           text NOT NULL CHECK (length(btrim(nombre)) > 0),
  fecha            date NOT NULL,
  descripcion      text,
  -- En qué aspectos de su vida le benefició. Obligatorio, uno o varios.
  beneficios       text[] NOT NULL CHECK (
                     cardinality(beneficios) > 0
                     AND beneficios <@ ARRAY['laboral', 'mental', 'social', 'corporal']::text[]
                   ),
  drive_folder_id  text NOT NULL,
  creado_en        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exp_personales_eventos_exp_idx ON gcc_world.exp_personales_eventos (experiencia_id, fecha DESC);
