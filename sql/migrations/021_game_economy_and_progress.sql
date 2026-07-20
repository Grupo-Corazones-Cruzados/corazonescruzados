-- 021 — Economía de fichas y progreso del juego (2026-07-20)
--
-- Principio rector: las fichas NO son una variable de juego, son un sistema de
-- pagos. Se canjean por productos y servicios reales del marketplace y, a
-- futuro, serán transferibles entre usuarios. Por eso el saldo NO es una
-- columna mutable: es el resultado derivado de un libro contable append-only.
-- Así una disputa por un canje se puede auditar, y una duplicación es
-- detectable a posteriori en vez de invisible.
--
-- La numeración arranca en 021 porque las migraciones 001-020 existieron y se
-- borraron el 2026-06-07. No se reutilizan esos números.

-- ---------------------------------------------------------------------------
-- Monedas
-- ---------------------------------------------------------------------------
-- Multi-moneda desde el principio: hay una contradicción sin resolver en el
-- diseño (si el recurso que se repone haciendo tareas del dashboard es la misma
-- ficha o es otro recurso). Modelarlo como tabla evita rehacer el libro si
-- resulta que son dos.
CREATE TABLE IF NOT EXISTS gcc_world.game_currencies (
  code          text PRIMARY KEY,
  name          text NOT NULL,
  -- Si es transferible entre usuarios, el listón antifraude sube: deja de ser
  -- puntuación y pasa a comportarse como dinero.
  transferable  boolean NOT NULL DEFAULT false,
  -- Techo diario de acuñación por usuario. La amenaza real no es "tengo 10.000
  -- fichas" (eso lo impide la autoridad del servidor) sino un script repitiendo
  -- una misión legítima 400 veces de noche. Eso se defiende con diseño.
  daily_mint_cap bigint,
  created_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO gcc_world.game_currencies (code, name, transferable, daily_mint_cap)
VALUES ('ficha', 'Ficha', false, 500)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Libro contable append-only
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gcc_world.ledger_entries (
  id              bigserial PRIMARY KEY,
  client_id       integer NOT NULL REFERENCES gcc_world.clients(id) ON DELETE CASCADE,
  currency        text NOT NULL REFERENCES gcc_world.game_currencies(code),
  -- Positivo acuña, negativo gasta. Nunca 0.
  amount          bigint NOT NULL CHECK (amount <> 0),
  -- Por qué se movió: 'quest_reward', 'item_pickup', 'purchase', 'transfer_in'…
  reason          text NOT NULL,
  ref_type        text,
  ref_id          text,
  -- La pieza que hace segura la operación bajo reintentos y dobles clics.
  idempotency_key text NOT NULL UNIQUE,
  -- Saldo resultante, congelado en el momento. Redundante a propósito: permite
  -- auditar la cadena sin recalcular todo el histórico.
  balance_after   bigint NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_client_idx
  ON gcc_world.ledger_entries (client_id, currency, created_at DESC);

-- Saldo materializado. Existe por dos razones: leer rápido, y ser la fila que
-- se bloquea (FOR UPDATE) para serializar movimientos concurrentes.
CREATE TABLE IF NOT EXISTS gcc_world.ledger_balances (
  client_id  integer NOT NULL REFERENCES gcc_world.clients(id) ON DELETE CASCADE,
  currency   text NOT NULL REFERENCES gcc_world.game_currencies(code),
  -- Red de seguridad a nivel de motor: ningún camino de código puede dejar un
  -- saldo negativo, ni siquiera por error.
  balance    bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, currency)
);

-- ---------------------------------------------------------------------------
-- Progreso del jugador
-- ---------------------------------------------------------------------------
-- Hoy no se guarda nada de esto: la posición y la escena se pierden al
-- recargar, y las cinemáticas vistas viven en localStorage (borrar los datos
-- del navegador las repite). Incompatible con "avanzar según resultados reales".
CREATE TABLE IF NOT EXISTS gcc_world.player_progress (
  client_id   integer PRIMARY KEY REFERENCES gcc_world.clients(id) ON DELETE CASCADE,
  scene_slug  text,
  pos_x       integer,
  pos_y       integer,
  facing      text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Banderas de mundo: cinemáticas vistas, secretos descubiertos, triggers
-- disparados. Sustituye al localStorage y al Set en memoria.
CREATE TABLE IF NOT EXISTS gcc_world.player_flags (
  client_id integer NOT NULL REFERENCES gcc_world.clients(id) ON DELETE CASCADE,
  flag      text NOT NULL,
  value     jsonb NOT NULL DEFAULT 'true'::jsonb,
  set_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, flag)
);

-- ---------------------------------------------------------------------------
-- Etapas y sus condiciones de apertura
-- ---------------------------------------------------------------------------
-- La idea más original del proyecto: hay etapas que solo se abren con
-- resultados REALES registrados en la app. La regla vive en datos, no en
-- código, para que las historias se puedan definir sin desplegar.
CREATE TABLE IF NOT EXISTS gcc_world.game_stages (
  slug        text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  order_idx   integer NOT NULL DEFAULT 0,
  -- Ej.: {"kind":"ticket_closed","count":1}
  unlock_rule jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gcc_world.player_stage_unlocks (
  client_id   integer NOT NULL REFERENCES gcc_world.clients(id) ON DELETE CASCADE,
  stage_slug  text NOT NULL REFERENCES gcc_world.game_stages(slug) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  -- Qué lo abrió exactamente. Sin esto, "¿por qué se me abrió?" no tiene
  -- respuesta cuando alguien reclame.
  evidence    jsonb,
  PRIMARY KEY (client_id, stage_slug)
);

-- Primera etapa configurada, según indicación del usuario: se abre al cerrarse
-- el primer ticket de la cuenta. Es provisional; las reglas definitivas
-- dependen de la historia del juego, que aún se está escribiendo.
INSERT INTO gcc_world.game_stages (slug, name, description, order_idx, unlock_rule)
VALUES (
  'primer-ticket',
  'El primer encargo',
  'Se abre cuando se cierra el primer ticket de la cuenta.',
  1,
  '{"kind":"ticket_closed","count":1}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Registro de acciones
-- ---------------------------------------------------------------------------
-- Se empieza a escribir desde el día uno a propósito: es el insumo para
-- detectar comportamiento automatizado más adelante, y no se puede reconstruir
-- retroactivamente. Si no se registra ahora, ese dato no existirá nunca.
CREATE TABLE IF NOT EXISTS gcc_world.game_action_log (
  id         bigserial PRIMARY KEY,
  client_id  integer REFERENCES gcc_world.clients(id) ON DELETE SET NULL,
  action     text NOT NULL,
  payload    jsonb,
  accepted   boolean NOT NULL DEFAULT true,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_action_log_client_idx
  ON gcc_world.game_action_log (client_id, created_at DESC);

-- Consultado en cada acuñación para aplicar el techo diario.
CREATE INDEX IF NOT EXISTS ledger_entries_daily_mint_idx
  ON gcc_world.ledger_entries (client_id, currency, created_at)
  WHERE amount > 0;
