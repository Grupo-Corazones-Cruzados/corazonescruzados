-- ─────────────────────────────────────────────────────────────────────────────
-- PLANTILLAS DE MENSAJE DEL AGENTE, Y SUS ENVÍOS A UNA LISTA
--
-- ── QUIÉN MANDA AQUÍ: META ────────────────────────────────────────────────────
-- Una plantilla NO es nuestra. Vive en la cuenta de WhatsApp del cliente, la aprueba o
-- rechaza Meta, y su estado cambia solo —una aprobada puede caerse después por baja
-- calidad—. Esta tabla es un ESPEJO, no la fuente de verdad: sirve para pintar la lista
-- sin llamar a Meta en cada carga, y para guardar lo único que es de verdad nuestro, que
-- es **a qué columna del contacto corresponde cada variable**.
--
-- Por eso `meta_id` y `estado` se refrescan desde Meta con el botón de sincronizar, y por
-- eso nada de aquí se da por bueno para enviar sin haber comprobado que sigue aprobada.
--
-- ── LAS VARIABLES ─────────────────────────────────────────────────────────────
-- Meta numera las variables del cuerpo: {{1}}, {{2}}… Nosotros guardamos, en orden, a qué
-- columna de `flow_contacts` corresponde cada una:
--
--     variables = ["name", "position", "email", "phone"]
--                    {{1}}     {{2}}      {{3}}    {{4}}
--
-- Se guarda como lista y no como objeto porque **el orden ES el significado**: es lo que
-- decide qué valor va en qué hueco al construir la llamada a la API.
--
-- ⚠️ Son las cuatro columnas que ya existen en `flow_contacts` (decisión de Fernando,
-- 2026-08-03: usar `position` —«Puesto»— en vez de añadir una columna «empresa», para no
-- tocar la tabla que comparte con el correo masivo).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gcc_world.agente_plantillas (
  id             SERIAL PRIMARY KEY,
  canal_id       INT NOT NULL REFERENCES gcc_world.agente_canales(id) ON DELETE CASCADE,

  -- Identidad en Meta. `meta_id` es NULO mientras el alta no ha llegado allí.
  meta_id        VARCHAR(64),
  nombre         VARCHAR(512) NOT NULL,
  idioma         VARCHAR(16)  NOT NULL DEFAULT 'es',
  categoria      VARCHAR(32)  NOT NULL DEFAULT 'UTILITY',

  -- Estado SEGÚN META: PENDING · APPROVED · REJECTED · PAUSED · DISABLED.
  -- `local` = creada aquí y todavía no enviada a Meta.
  estado         VARCHAR(32)  NOT NULL DEFAULT 'local',
  motivo_rechazo TEXT,

  encabezado     TEXT,
  cuerpo         TEXT NOT NULL,
  pie            VARCHAR(60),

  -- A qué columna de `flow_contacts` corresponde cada {{n}}, en orden.
  variables      JSONB NOT NULL DEFAULT '[]',

  sincronizado_en TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meta identifica una plantilla por nombre + idioma dentro de una cuenta. Se replica esa
-- regla aquí para que dos filas no puedan reclamar la misma plantilla.
CREATE UNIQUE INDEX IF NOT EXISTS agente_plantillas_nombre_idx
  ON gcc_world.agente_plantillas (canal_id, nombre, idioma);

COMMENT ON TABLE gcc_world.agente_plantillas IS
  'Espejo de las plantillas de la WABA del cliente + el mapeo de sus variables a columnas de flow_contacts. La fuente de verdad del estado es Meta.';


-- ─────────────────────────────────────────────────────────────────────────────
-- ENVÍOS
--
-- Un envío es «esta plantilla a esta lista». Se guarda aparte de los mensajes porque hay
-- que poder responder «¿cómo fue aquel envío?» sin recorrer miles de mensajes sueltos, y
-- porque un envío a medias —cortado por un reinicio— tiene que poder distinguirse de uno
-- terminado.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gcc_world.agente_envios (
  id            SERIAL PRIMARY KEY,
  canal_id      INT NOT NULL REFERENCES gcc_world.agente_canales(id) ON DELETE CASCADE,
  plantilla_id  INT NOT NULL REFERENCES gcc_world.agente_plantillas(id) ON DELETE CASCADE,
  lista_id      INT REFERENCES gcc_world.flow_contact_lists(id) ON DELETE SET NULL,

  -- enviando · terminado · error
  estado        VARCHAR(20) NOT NULL DEFAULT 'enviando',
  total         INT NOT NULL DEFAULT 0,
  enviados      INT NOT NULL DEFAULT 0,
  fallidos      INT NOT NULL DEFAULT 0,
  error         TEXT,

  -- Quién lo lanzó. Un envío masivo sin autor es una pregunta sin respuesta el día que
  -- alguien pregunte por qué se mandó.
  lanzado_por   UUID REFERENCES gcc_world.users(id) ON DELETE SET NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminado_en  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS agente_envios_canal_idx ON gcc_world.agente_envios (canal_id, created_at DESC);

COMMENT ON TABLE gcc_world.agente_envios IS
  'Cada envío de una plantilla a una lista de contactos, con su recuento y su autor.';


-- El mensaje que sale de un envío se guarda en `agente_mensajes` como cualquier otro, con
-- `herramienta = 'plantilla'`. Así aparece en la bandeja, en su conversación, junto a lo
-- que dijo el agente y lo que escribió una persona — que es donde alguien lo va a buscar.
-- `envio_id` permite volver del mensaje al envío que lo produjo.
ALTER TABLE gcc_world.agente_mensajes
  ADD COLUMN IF NOT EXISTS envio_id INT REFERENCES gcc_world.agente_envios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS agente_mensajes_envio_idx ON gcc_world.agente_mensajes (envio_id);
