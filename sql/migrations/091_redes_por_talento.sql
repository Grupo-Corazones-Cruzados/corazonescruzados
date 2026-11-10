-- REDES SOCIALES POR TALENTO (Fernando, 2026-11-10).
-- Cada talento de una persona conecta sus propias redes, una cuenta por red y talento: lfgonzalezm0 es
-- «Automatización de procesos» y lfgonzalezm1 es «Psicología». Sustituye a los enlaces escritos a mano del
-- perfil (users.*_handle) en el CV compartido y a `gcont_redes_cuentas` en Generación de Contenido.
--
-- El talento se guarda por su nombre, que es la clave con que vive en `member_cv_profiles.talents[].key`.
-- Los permisos van cifrados (`lib/cifrado.ts`), atados a la red y la cuenta externa.
-- Idempotente: el código la asegura igual (`lib/redes/talento.ts`).

CREATE TABLE IF NOT EXISTS gcc_world.redes_talento (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES gcc_world.users (id) ON DELETE CASCADE,
  talento       TEXT        NOT NULL,
  red           TEXT        NOT NULL CHECK (red IN ('youtube', 'instagram', 'facebook', 'tiktok', 'linkedin')),
  externo_id    TEXT        NOT NULL,
  nombre        TEXT        NOT NULL,
  url           TEXT,
  token_cifrado TEXT        NOT NULL,
  extra         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  estado        TEXT        NOT NULL DEFAULT 'activa',
  conectada_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, talento, red)
);

-- Un intento de conexión: el `state` del OAuth. Se gasta al volver y caduca a los 15 minutos. Sirve también
-- cuando se conecta desde la app, que abre el navegador del sistema sin la sesión de la app.
CREATE TABLE IF NOT EXISTS gcc_world.redes_talento_intentos (
  nonce      TEXT        PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES gcc_world.users (id) ON DELETE CASCADE,
  talento    TEXT        NOT NULL,
  red        TEXT        NOT NULL,
  origen     TEXT        NOT NULL DEFAULT 'web',
  verificador TEXT,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
