-- ─────────────────────────────────────────────────────────────────────────────
-- 066 · Dispositivos para notificaciones push de la app nativa (Fernando, 2026-10-06)
-- ─────────────────────────────────────────────────────────────────────────────
-- Cada teléfono con la app instalada registra aquí su token de push al abrirse con sesión.
-- Lo primero que se avisa por aquí es el reloj del ticket: al iniciarlo o detenerlo en el
-- computador, el teléfono se entera al instante y ajusta su notificación.
--
--   kind = 'fcm'             → Android (Firebase Cloud Messaging)
--          'apns'            → iPhone, notificaciones normales
--          'apns_live_start' → iPhone, token para arrancar la Actividad en Vivo por push
--
-- El token es del TELÉFONO, no de la persona: si en ese teléfono entra otra cuenta, el
-- token pasa a ella (upsert por `kind, token`). Un token que FCM/APNs da por muerto se borra
-- al intentar enviarle.
CREATE TABLE IF NOT EXISTS gcc_world.push_devices (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES gcc_world.users(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  kind        TEXT NOT NULL CHECK (kind IN ('fcm', 'apns', 'apns_live_start')),
  token       TEXT NOT NULL CHECK (char_length(token) BETWEEN 10 AND 4096),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, token)
);
CREATE INDEX IF NOT EXISTS push_devices_user_idx ON gcc_world.push_devices (user_id);
