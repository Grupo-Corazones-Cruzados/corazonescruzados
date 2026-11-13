-- DENUNCIAR Y BLOQUEAR (Fernando, 2026-11-13). Apple rechazó GCC World (norma 2.1, que remite a la 1.2): una app
-- donde los usuarios comparten contenido tiene que dejar DENUNCIARLO y BLOQUEAR a quien lo publica, y el equipo
-- tiene que actuar sobre las denuncias (Apple espera menos de 24 horas).
--
-- · Denuncia: sobre una publicación del Marketplace (ficha de portafolio o proyecto publicado) o un mensaje de chat.
--   Guarda un EXTRACTO del contenido al denunciar: si el autor lo borra después, la denuncia sigue diciendo qué fue.
--   El administrador la resuelve: «retirado» (se quita el contenido) o «descartada».
-- · Bloqueo: personal. Quien bloquea deja de ver lo que publica la otra persona (Marketplace y chats). Se guarda
--   la cuenta y, si la tiene, la ficha de miembro: el Marketplace se filtra por ficha y el chat por cuenta.
-- · Retirar una ficha de portafolio NO la borra: queda oculta del Marketplace (`retirado_moderacion_en`) y su autor
--   la conserva. Un proyecto retirado deja de estar publicado. Un mensaje retirado sí se borra.
--
-- Sin esta migración el resto de la plataforma funciona igual. Idempotente.

CREATE TABLE IF NOT EXISTS gcc_world.moderacion_denuncias (
  id              BIGSERIAL PRIMARY KEY,
  denunciante_id  UUID         NOT NULL,
  tipo            VARCHAR(12)  NOT NULL CHECK (tipo IN ('portafolio', 'proyecto', 'mensaje')),
  objeto_id       TEXT         NOT NULL,
  -- La cuenta autora del contenido, si se conoce (un proyecto es de un equipo: NULL).
  autor_id        UUID,
  motivo          VARCHAR(12)  NOT NULL CHECK (motivo IN ('ofensivo', 'acoso', 'engano', 'spam', 'otro')),
  detalle         TEXT,
  extracto        TEXT,
  estado          VARCHAR(12)  NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'retirado', 'descartada')),
  resuelta_por    UUID,
  resuelta_en     TIMESTAMPTZ,
  creada_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS moderacion_denuncias_estado_idx ON gcc_world.moderacion_denuncias (estado, creada_en DESC);
-- Una persona no denuncia dos veces lo mismo mientras siga pendiente.
CREATE UNIQUE INDEX IF NOT EXISTS moderacion_denuncias_una_pendiente
  ON gcc_world.moderacion_denuncias (denunciante_id, tipo, objeto_id) WHERE estado = 'pendiente';

CREATE TABLE IF NOT EXISTS gcc_world.moderacion_bloqueos (
  id                   BIGSERIAL PRIMARY KEY,
  usuario_id           UUID        NOT NULL,
  bloqueado_user_id    UUID,
  bloqueado_member_id  BIGINT,
  nombre               TEXT,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (bloqueado_user_id IS NOT NULL OR bloqueado_member_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS moderacion_bloqueos_usuario_uidx
  ON gcc_world.moderacion_bloqueos (usuario_id, bloqueado_user_id) WHERE bloqueado_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS moderacion_bloqueos_ficha_uidx
  ON gcc_world.moderacion_bloqueos (usuario_id, bloqueado_member_id) WHERE bloqueado_user_id IS NULL;
CREATE INDEX IF NOT EXISTS moderacion_bloqueos_usuario_idx ON gcc_world.moderacion_bloqueos (usuario_id);

ALTER TABLE gcc_world.member_portfolio_items ADD COLUMN IF NOT EXISTS retirado_moderacion_en TIMESTAMPTZ;
