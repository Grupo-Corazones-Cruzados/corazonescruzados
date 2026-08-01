-- 027 · Esquema del AGENTE IA de WhatsApp (flujo de tipo `ai_agent`)
--
-- Porta a GCC World la arquitectura documentada en guia-coexistencia-proveedor.html,
-- que ya funciona en producción en el sistema contable de Peters Tours. Esa guía es la
-- NORMA del producto: los parámetros por defecto de aquí son los suyos.
--
-- EL TENANT ES EL FLUJO. Un flujo de tipo `ai_agent` = un canal = un número de WhatsApp
-- = una empresa cliente. El hallazgo de la guía —«un canal es exactamente un tenant»—
-- aplica igual aquí, así que el aislamiento sale del modelo de datos y no de acordarse
-- de filtrar en cada consulta.
--
-- Los dos acoplamientos a un solo cliente que la guía señala quedan resueltos por diseño:
--   1. `agente_canales.phone_number_id` es ÚNICO ⇒ el webhook resuelve a qué cliente
--      pertenece cada mensaje con el `metadata.phone_number_id` que manda Meta.
--   2. El token de WhatsApp y la clave de IA viven POR CANAL y CIFRADOS. Con N clientes
--      la regla vieja («los secretos solo en variables de entorno») no escala: cada alta
--      por Embedded Signup devuelve un token propio. Es una decisión consciente.
--
-- Se elimina de paso el chatbot viejo (iba por YCloud, un intermediario, y la decisión
-- cerrada es API oficial de Meta). Comprobado el 2026-08-01 contra la base de producción:
-- sus tablas NI SIQUIERA EXISTEN — se creaban con ensureTables() bajo demanda y esa ruta
-- nunca se llamó. Los DROP van por si acaso en algún entorno sí llegaron a crearse.

-- ───────────────────────────────────────────────────────────────────────────────
-- 1 · Fuera el chatbot deprecado (YCloud)
-- ───────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS gcc_world.flow_chatbot_messages      CASCADE;
DROP TABLE IF EXISTS gcc_world.flow_chatbot_conversations CASCADE;
DROP TABLE IF EXISTS gcc_world.flow_chatbot_qa_items      CASCADE;
DROP TABLE IF EXISTS gcc_world.flow_chatbot_qa_lists      CASCADE;
DROP TABLE IF EXISTS gcc_world.flow_chatbot_knowledge     CASCADE;
DROP TABLE IF EXISTS gcc_world.flow_chatbot_agents        CASCADE;

-- Los flujos que hubieran quedado de tipo `chatbot` pasan a `ai_agent`: es el único
-- camino conversacional que queda. No hay ninguno hoy, pero la migración no puede dejar
-- filas apuntando a un tipo que ya no existe.
UPDATE gcc_world.flows SET type = 'ai_agent' WHERE type = 'chatbot';

-- ───────────────────────────────────────────────────────────────────────────────
-- 2 · Canales — la tabla de tenants. Un canal = un número = un cliente.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gcc_world.agente_canales (
  id                 SERIAL PRIMARY KEY,
  flow_id            INT NOT NULL UNIQUE REFERENCES gcc_world.flows(id) ON DELETE CASCADE,

  -- Identificadores de Meta. Llegan del canje del Embedded Signup; son públicos.
  waba_id            VARCHAR(50),
  phone_number_id    VARCHAR(50),
  numero_visible     VARCHAR(40),   -- +593 99 ... tal como lo muestra Meta
  nombre_verificado  VARCHAR(255),  -- el nombre del negocio verificado en la WABA

  -- Secretos. SIEMPRE cifrados (AES-256-GCM, clave maestra en el entorno).
  -- Nunca se leen desde el navegador: solo el runner y el webhook los descifran.
  wa_token_cifrado   TEXT,          -- token del cliente, del canje de Embedded Signup
  ia_api_key_cifrada TEXT,          -- clave de IA del cliente (decisión: la pone él)
  pin_cifrado        TEXT,          -- PIN de verificación en dos pasos del número

  ia_proveedor       VARCHAR(30)  NOT NULL DEFAULT 'anthropic',

  -- Parámetros de ejecución. Los valores por defecto son los de la guía, medidos en
  -- producción: no se cambian sin un motivo, y menos "porque suena mejor".
  modelo             VARCHAR(100) NOT NULL DEFAULT 'claude-haiku-4-5',
  max_tokens         INT          NOT NULL DEFAULT 4096,  -- acota razonamiento + respuesta
  debounce_segundos  INT          NOT NULL DEFAULT 8,     -- agrupa ráfagas en una corrida
  ventana_mensajes   INT          NOT NULL DEFAULT 40,    -- + el resumen acumulado

  -- El agente NO se enciende solo: se activa a mano desde el Estudio, a propósito.
  bot_activo         BOOLEAN      NOT NULL DEFAULT false,

  -- Estado del alta del número. `coexistencia_verificada` marca la única comprobación
  -- que de verdad importa: que el equipo del cliente sigue teniendo WhatsApp Web.
  estado                  VARCHAR(30) NOT NULL DEFAULT 'sin_conectar',
  coexistencia_verificada BOOLEAN     NOT NULL DEFAULT false,

  -- Último fallo visible en el panel. Si la clave de IA del cliente deja de servir, la
  -- conversación escala a un humano y el motivo se ve AQUÍ: un agente mudo en silencio
  -- es el peor final posible.
  ultimo_error       TEXT,
  ultimo_error_en    TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT agente_canales_estado_chk CHECK (
    estado IN ('sin_conectar', 'conectando', 'conectado', 'error', 'desconectado')
  ),
  CONSTRAINT agente_canales_ia_proveedor_chk CHECK (ia_proveedor IN ('anthropic', 'openai')),
  CONSTRAINT agente_canales_debounce_chk     CHECK (debounce_segundos BETWEEN 0 AND 120),
  CONSTRAINT agente_canales_ventana_chk      CHECK (ventana_mensajes BETWEEN 2 AND 400)
);

-- ESTE índice es el que resuelve el multi-tenant: el webhook recibe
-- `metadata.phone_number_id` y con él sabe de qué cliente es el mensaje. Parcial porque
-- un canal recién creado todavía no tiene número asignado.
CREATE UNIQUE INDEX IF NOT EXISTS agente_canales_phone_number_id_uq
  ON gcc_world.agente_canales (phone_number_id)
  WHERE phone_number_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agente_canales_waba_idx
  ON gcc_world.agente_canales (waba_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3 · Contactos y conversaciones
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gcc_world.agente_contactos (
  id            SERIAL PRIMARY KEY,
  canal_id      INT NOT NULL REFERENCES gcc_world.agente_canales(id) ON DELETE CASCADE,
  wa_id         VARCHAR(40) NOT NULL,   -- el número del contacto, como lo manda Meta
  nombre_perfil VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (canal_id, wa_id)
);

-- Una conversación PERMANENTE por contacto, sin expiración (decisión cerrada). La
-- sesión es una fila de la base, no un objeto del proveedor.
CREATE TABLE IF NOT EXISTS gcc_world.agente_conversaciones (
  id                 SERIAL PRIMARY KEY,
  canal_id           INT NOT NULL REFERENCES gcc_world.agente_canales(id)   ON DELETE CASCADE,
  contacto_id        INT NOT NULL REFERENCES gcc_world.agente_contactos(id) ON DELETE CASCADE,

  -- La TOMA HUMANA: apagar el bot en ESTA conversación, sin tocar el resto del canal.
  bot_activo         BOOLEAN NOT NULL DEFAULT true,
  tomada_por         UUID REFERENCES gcc_world.users(id) ON DELETE SET NULL,
  tomada_en          TIMESTAMPTZ,
  motivo_escalado    TEXT,

  -- Memoria larga: se recalcula cuando la conversación crece más allá de la ventana.
  resumen            TEXT,
  resumen_hasta_id   INT,

  ultimo_mensaje_en  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (canal_id, contacto_id)
);

CREATE INDEX IF NOT EXISTS agente_conversaciones_bandeja_idx
  ON gcc_world.agente_conversaciones (canal_id, ultimo_mensaje_en DESC);

-- ───────────────────────────────────────────────────────────────────────────────
-- 4 · Mensajes — la idempotencia vive aquí
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gcc_world.agente_mensajes (
  id              SERIAL PRIMARY KEY,
  conversacion_id INT NOT NULL REFERENCES gcc_world.agente_conversaciones(id) ON DELETE CASCADE,
  direccion       VARCHAR(10) NOT NULL,

  -- ⇒ IDEMPOTENCIA. Meta reintenta los webhooks; sin esto el mismo mensaje se
  -- procesaría dos veces y el contacto recibiría dos respuestas.
  wa_message_id   VARCHAR(128),

  tipo            VARCHAR(30) NOT NULL DEFAULT 'text',
  texto           TEXT,
  payload         JSONB,

  -- Ubicación compartida. `ubicacion_resuelta_en` marca el INTENTO, no el éxito: si
  -- marcara el éxito, un enlace roto se reintentaría en cada corrida para siempre.
  ubicacion_lat        DOUBLE PRECISION,
  ubicacion_lng        DOUBLE PRECISION,
  ubicacion_texto      TEXT,
  ubicacion_resuelta_en TIMESTAMPTZ,

  -- Lo escribe el agente cuando responde: qué herramienta eligió y por qué.
  herramienta     VARCHAR(30),
  motivo          TEXT,

  enviado_ok      BOOLEAN,
  error_envio     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT agente_mensajes_direccion_chk CHECK (direccion IN ('entrante', 'saliente')),
  CONSTRAINT agente_mensajes_herramienta_chk CHECK (
    herramienta IS NULL OR herramienta IN ('responder', 'no_responder', 'escalar_a_humano')
  )
);

-- Único y parcial: los mensajes salientes propios no siempre traen id de Meta.
CREATE UNIQUE INDEX IF NOT EXISTS agente_mensajes_wa_message_id_uq
  ON gcc_world.agente_mensajes (wa_message_id)
  WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agente_mensajes_conversacion_idx
  ON gcc_world.agente_mensajes (conversacion_id, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────────
-- 5 · Conocimiento y prompts — por canal, versionados
-- ───────────────────────────────────────────────────────────────────────────────
-- Se redacta DESCRIPTIVO, no como pares pregunta→respuesta: con pares, un carácter
-- distinto en la pregunta rompía la coincidencia. Entra COMPLETO en el prompt cacheado;
-- no hay búsqueda ni embeddings.
CREATE TABLE IF NOT EXISTS gcc_world.agente_conocimiento (
  id         SERIAL PRIMARY KEY,
  canal_id   INT NOT NULL REFERENCES gcc_world.agente_canales(id) ON DELETE CASCADE,
  clave      VARCHAR(60)  NOT NULL,   -- empresa, pagos, horario_atencion…
  titulo     VARCHAR(255) NOT NULL,
  contenido  TEXT NOT NULL DEFAULT '',
  orden      INT  NOT NULL DEFAULT 0,
  activo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (canal_id, clave)
);

-- Nota de diseño: los bloques PENDIENTES no se escriben a mano en el prompt. Se
-- CALCULAN de aquí (los que contienen «[PENDIENTE]») y se inyectan al ensamblarlo.
-- En Peters Tours ese desajuste está vivo: el prompt manda escalar por pagos y horario
-- que el cliente ya rellenó, así que el agente pasa a una persona preguntas que sabe
-- contestar. Con N clientes eso se multiplica.

CREATE TABLE IF NOT EXISTS gcc_world.agente_prompts (
  id         SERIAL PRIMARY KEY,
  canal_id   INT NOT NULL REFERENCES gcc_world.agente_canales(id) ON DELETE CASCADE,
  tipo       VARCHAR(40) NOT NULL,
  version    INT NOT NULL DEFAULT 1,
  contenido  TEXT NOT NULL DEFAULT '',
  activo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agente_prompts_tipo_chk CHECK (
    tipo IN ('perfil_agente', 'reglas_negocio', 'resumen_conversacion')
  )
);

-- Al guardar se conserva la versión anterior: solo UNA activa por tipo y canal.
CREATE UNIQUE INDEX IF NOT EXISTS agente_prompts_activo_uq
  ON gcc_world.agente_prompts (canal_id, tipo)
  WHERE activo;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6 · Cola de trabajos — debounce e idempotencia, EN LA BASE
-- ───────────────────────────────────────────────────────────────────────────────
-- El chatbot viejo hacía el debounce con setTimeout en memoria del proceso. En Railway
-- un redeploy —o un segundo contenedor— se lleva por delante ese temporizador y el
-- mensaje se pierde sin dejar rastro. Aquí la cola es una tabla, y el worker reclama
-- con FOR UPDATE SKIP LOCKED.
CREATE TABLE IF NOT EXISTS gcc_world.agente_cola (
  id              SERIAL PRIMARY KEY,
  conversacion_id INT NOT NULL REFERENCES gcc_world.agente_conversaciones(id) ON DELETE CASCADE,
  estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  ejecutar_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- ahora + debounce del canal
  intentos        INT NOT NULL DEFAULT 0,
  reclamado_en    TIMESTAMPTZ,   -- para recuperar trabajos colgados
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agente_cola_estado_chk CHECK (
    estado IN ('pendiente', 'procesando', 'hecho', 'error')
  )
);

-- ⇒ EL DEBOUNCE. Único parcial + ON CONFLICT: mientras haya un trabajo sin terminar
-- para esa conversación, encolar otra vez solo EMPUJA su `ejecutar_en` hacia adelante.
-- Una ráfaga de seis mensajes produce UNA corrida del modelo, no seis.
CREATE UNIQUE INDEX IF NOT EXISTS agente_cola_pendiente_uq
  ON gcc_world.agente_cola (conversacion_id)
  WHERE estado IN ('pendiente', 'procesando');

CREATE INDEX IF NOT EXISTS agente_cola_reclamar_idx
  ON gcc_world.agente_cola (estado, ejecutar_en)
  WHERE estado = 'pendiente';

-- ───────────────────────────────────────────────────────────────────────────────
-- 7 · Traza y consumo
-- ───────────────────────────────────────────────────────────────────────────────
-- Traza cruda de lo que manda Meta. `firma_valida` deja constancia de los intentos
-- rechazados: un webhook sin firma correcta se responde 403 y se apunta aquí.
CREATE TABLE IF NOT EXISTS gcc_world.agente_eventos_webhook (
  id           SERIAL PRIMARY KEY,
  canal_id     INT REFERENCES gcc_world.agente_canales(id) ON DELETE SET NULL,
  firma_valida BOOLEAN NOT NULL DEFAULT false,
  payload      JSONB,
  recibido_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agente_eventos_webhook_recibido_idx
  ON gcc_world.agente_eventos_webhook (recibido_en DESC);

-- Consumo por conversación. La IA la paga el cliente con su propia clave, así que esto
-- ya no es la base de la facturación — pero sí la traza que le explica su gasto, y la
-- única forma de comprobar que el prefijo cacheado de verdad cachea (mirando
-- tokens_cache_lectura: por debajo del mínimo del modelo NO cachea y no avisa).
CREATE TABLE IF NOT EXISTS gcc_world.agente_uso_modelo (
  id                     SERIAL PRIMARY KEY,
  conversacion_id        INT REFERENCES gcc_world.agente_conversaciones(id) ON DELETE CASCADE,
  modelo                 VARCHAR(100) NOT NULL,
  tokens_entrada         INT NOT NULL DEFAULT 0,
  tokens_salida          INT NOT NULL DEFAULT 0,
  tokens_cache_escritura INT NOT NULL DEFAULT 0,
  tokens_cache_lectura   INT NOT NULL DEFAULT 0,
  herramienta            VARCHAR(30),
  duracion_ms            INT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agente_uso_modelo_conversacion_idx
  ON gcc_world.agente_uso_modelo (conversacion_id, created_at DESC);
