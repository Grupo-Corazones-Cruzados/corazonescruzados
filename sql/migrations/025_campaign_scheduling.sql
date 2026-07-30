-- 025 — Campañas programadas y envío por lotes reanudable (2026-07-30)
--
-- Contexto: hasta ahora una campaña solo salía si alguien pulsaba "Enviar", y el envío
-- recorría TODOS los contactos dentro de la misma petición HTTP. Con listas grandes eso
-- choca con el tope duro de ~300 s por petición de Railway/Cloudflare: el envío se corta a
-- medias y la campaña queda marcada como 'sending' para siempre.
--
-- Con esto:
--   * `scheduled_at` = cuándo debe salir. El cron (cada 10 min) arranca las vencidas.
--   * `send_started_at` = cuándo arrancó el envío EN CURSO. Es la clave de la reanudación:
--     los destinatarios pendientes son los que NO tienen fila en `flow_campaign_sends` con
--     `sent_at >= send_started_at`. Así cada pase del cron sigue donde quedó el anterior, sin
--     repetirle el correo a nadie, y un REENVÍO (que sí debe volver a escribir a todos) solo
--     tiene que fijar un `send_started_at` nuevo para empezar de cero.
--
-- Estado nuevo: 'scheduled' (esperando su hora). No hay CHECK en la columna `status`, así que
-- no hace falta ampliar nada.

ALTER TABLE gcc_world.flow_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS send_started_at TIMESTAMPTZ;

-- El cron busca por (estado, hora): que no tenga que escanear la tabla entera cada 10 min.
CREATE INDEX IF NOT EXISTS flow_campaigns_scheduled_idx
  ON gcc_world.flow_campaigns (status, scheduled_at)
  WHERE status IN ('scheduled', 'sending');

-- Buscar "¿a quién ya le escribí en este run?" es la consulta más repetida del envío.
CREATE INDEX IF NOT EXISTS flow_campaign_sends_campaign_sent_idx
  ON gcc_world.flow_campaign_sends (campaign_id, sent_at);

-- Las campañas ya enviadas antes de esta migración no tienen `send_started_at`; se les pone
-- su `sent_at` para que sus envíos históricos cuenten como "de este run" y un reenvío futuro
-- no los confunda con pendientes.
UPDATE gcc_world.flow_campaigns
   SET send_started_at = sent_at
 WHERE status = 'sent' AND sent_at IS NOT NULL AND send_started_at IS NULL;
