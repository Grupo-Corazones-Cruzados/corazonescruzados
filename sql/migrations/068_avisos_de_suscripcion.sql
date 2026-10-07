-- ─────────────────────────────────────────────────────────────────────────────
-- 068 · Avisos de suscripción por vencer (Fernando, 2026-10-07)
-- ─────────────────────────────────────────────────────────────────────────────
-- «Que notifique suscripciones cuando una suscripción de un cliente está por vencer; debe
-- llegarle al cliente que paga y al dueño, miembro o admin que se la ofreció.»
--
-- El cron pasa cada 10 minutos: esta tabla es lo que hace que cada aviso salga UNA vez.
-- Una fila por (suscripción, mes, etapa); se inserta ANTES de enviar y solo envía quien la
-- inserta, así que dos corridas a la vez tampoco duplican.
--   etapa: 'proximo' (vence en 2–7 días) · 'manana' · 'hoy' · 'vencida'
CREATE TABLE IF NOT EXISTS gcc_world.subscription_alerts (
  subscription_id INT  NOT NULL REFERENCES gcc_world.subscriptions(id) ON DELETE CASCADE,
  period          DATE NOT NULL,
  stage           TEXT NOT NULL CHECK (stage IN ('proximo', 'manana', 'hoy', 'vencida')),
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (subscription_id, period, stage)
);
