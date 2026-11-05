-- CONTROL PSICOSOCIAL · recorrido y puntos de reunión (Fernando, 2026-11-05).

-- Qué versión del texto aceptó. El recorrido y las llegadas solo cuentan desde la versión 3: quien
-- aceptó compartir su «última ubicación» no aceptó enseñar todo su recorrido.
ALTER TABLE gcc_world.cp_miembros ADD COLUMN IF NOT EXISTS ubicacion_version INT NOT NULL DEFAULT 0;
UPDATE gcc_world.cp_miembros c
   SET ubicacion_version = COALESCE((
     SELECT x.version FROM gcc_world.cp_consentimientos x
      WHERE x.user_id = c.user_id AND x.funcion = 'ubicacion' AND x.accion = 'otorgado'
      ORDER BY x.creado_en DESC LIMIT 1), 0);

-- Los puntos de reunión. Solo los crea un administrador.
CREATE TABLE IF NOT EXISTS gcc_world.cp_lugares (
  id             SERIAL PRIMARY KEY,
  nombre         TEXT NOT NULL,
  lat            DOUBLE PRECISION NOT NULL,
  lng            DOUBLE PRECISION NOT NULL,
  radio_m        INT NOT NULL CHECK (radio_m BETWEEN 30 AND 5000),
  creado_por     UUID REFERENCES gcc_world.users(id) ON DELETE SET NULL,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cada estancia en un lugar. Abierta = sigue allí.
CREATE TABLE IF NOT EXISTS gcc_world.cp_visitas (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES gcc_world.users(id) ON DELETE CASCADE,
  lugar_id   INT NOT NULL REFERENCES gcc_world.cp_lugares(id) ON DELETE CASCADE,
  llegada_en TIMESTAMPTZ NOT NULL,
  salida_en  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS cp_visitas_una_abierta ON gcc_world.cp_visitas(user_id, lugar_id) WHERE salida_en IS NULL;
CREATE INDEX IF NOT EXISTS cp_visitas_user_idx ON gcc_world.cp_visitas(user_id, llegada_en DESC);
