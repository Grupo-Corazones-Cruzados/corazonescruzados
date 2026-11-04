-- CONTROL PSICOSOCIAL (Centralizado · colaborador · implementación). Primera sección: Rastreo.
-- Ubicación y voz van con consentimiento propio y separado (compromiso de /legal §9): nadie queda
-- rastreado sin haberlo activado desde su teléfono, y lo puede apagar cuando quiera.

-- Estado actual de cada persona. La fila solo existe si alguna vez aceptó algo.
CREATE TABLE IF NOT EXISTS gcc_world.cp_miembros (
  user_id          UUID PRIMARY KEY REFERENCES gcc_world.users(id) ON DELETE CASCADE,
  ubicacion_activa BOOLEAN NOT NULL DEFAULT false,
  voz_activa       BOOLEAN NOT NULL DEFAULT false,
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constancia de cada aceptación y retirada. Solo se añade: es la prueba del consentimiento.
CREATE TABLE IF NOT EXISTS gcc_world.cp_consentimientos (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES gcc_world.users(id) ON DELETE CASCADE,
  funcion    TEXT NOT NULL CHECK (funcion IN ('ubicacion', 'voz')),
  accion     TEXT NOT NULL CHECK (accion IN ('otorgado', 'retirado')),
  version    INT  NOT NULL,
  plataforma TEXT,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cp_consentimientos_user_idx ON gcc_world.cp_consentimientos(user_id, creado_en DESC);

-- La llave propia del teléfono. La sesión caduca a los 7 días y un rastreo de seguridad no puede
-- apagarse solo por eso. Se guarda el hash; la llave solo existe en el teléfono.
CREATE TABLE IF NOT EXISTS gcc_world.cp_dispositivos (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES gcc_world.users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  plataforma      TEXT NOT NULL CHECK (plataforma IN ('android', 'ios')),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_contacto TIMESTAMPTZ,
  revocado_en     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS cp_dispositivos_user_idx ON gcc_world.cp_dispositivos(user_id) WHERE revocado_en IS NULL;

CREATE TABLE IF NOT EXISTS gcc_world.cp_alertas (
  id           SERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES gcc_world.users(id) ON DELETE CASCADE,
  origen       TEXT NOT NULL CHECK (origen IN ('boton', 'voz')),
  estado       TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cerrada')),
  motivo       TEXT CHECK (motivo IN ('resuelta', 'falsa')),
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  creada_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrada_en   TIMESTAMPTZ,
  cerrada_por  UUID REFERENCES gcc_world.users(id) ON DELETE SET NULL
);
-- Una persona tiene como mucho un auxilio abierto: repetirlo no vuelve a avisar a todos.
CREATE UNIQUE INDEX IF NOT EXISTS cp_alertas_una_activa ON gcc_world.cp_alertas(user_id) WHERE estado = 'activa';
CREATE INDEX IF NOT EXISTS cp_alertas_fecha_idx ON gcc_world.cp_alertas(creada_en DESC);

-- Lo que entra durante un auxilio lleva `alerta_id` y no se purga con el resto (7 días).
CREATE TABLE IF NOT EXISTS gcc_world.cp_posiciones (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES gcc_world.users(id) ON DELETE CASCADE,
  dispositivo_id INT REFERENCES gcc_world.cp_dispositivos(id) ON DELETE SET NULL,
  alerta_id     INT REFERENCES gcc_world.cp_alertas(id) ON DELETE SET NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  precision_m   REAL,
  bateria       SMALLINT,
  registrada_en TIMESTAMPTZ NOT NULL,
  recibida_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cp_posiciones_ultima_idx ON gcc_world.cp_posiciones(user_id, registrada_en DESC);
CREATE INDEX IF NOT EXISTS cp_posiciones_purga_idx ON gcc_world.cp_posiciones(registrada_en) WHERE alerta_id IS NULL;

-- Quién miró la ubicación de quién. Cada miembro ve la suya.
CREATE TABLE IF NOT EXISTS gcc_world.cp_accesos (
  id        BIGSERIAL PRIMARY KEY,
  quien     UUID NOT NULL REFERENCES gcc_world.users(id) ON DELETE CASCADE,
  a_quien   UUID NOT NULL REFERENCES gcc_world.users(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cp_accesos_a_quien_idx ON gcc_world.cp_accesos(a_quien, creado_en DESC);

INSERT INTO gcc_world.centralized_systems (name, description, piso, paso, cell_name, slug)
SELECT 'Control Psicosocial',
       'Seguridad de los miembros. Rastreo con consentimiento de cada miembro, botón de auxilio, llamada al 911 y detección de una frase clave que avisa a todos los miembros.',
       'colaborador', 'implementacion', 'Planificador', 'control-psicosocial'
 WHERE NOT EXISTS (SELECT 1 FROM gcc_world.centralized_systems WHERE slug = 'control-psicosocial');
