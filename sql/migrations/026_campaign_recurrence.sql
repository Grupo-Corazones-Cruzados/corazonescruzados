-- 026 — Campañas con FRECUENCIA (recurrentes), no solo una fecha (2026-07-30)
--
-- Contexto: la migración 025 dejó programar una campaña para una fecha y hora concretas. Lo
-- que se pidió después es poder repetirla: cada N segundos / minutos / horas / días / meses /
-- años, desde una fecha de inicio y con fecha de fin OPCIONAL; al pasar el fin, deja de
-- lanzarse (y el flujo se pausa solo si no le queda nada pendiente).
--
-- Modelo:
--   * `schedule_kind`  'once' | 'recurring'
--   * `freq_unit` + `freq_interval`  → "cada 2 horas", "cada 3 meses"
--   * `recur_until`    último instante en el que puede salir (inclusive). NULL = sin fin.
--   * `next_run_at`    LA fuente de verdad del disparador. NULL = nada pendiente.
--   * `run_count`      cuántas veces ya salió.
--
-- Por qué `run_count` y no ir sumando sobre `next_run_at`: encadenar sumas arrastra el
-- redondeo de los meses cortos (31 ene → 28 feb → 28 mar → …) y la serie se desplaza sola.
-- Con el contador, cada ocurrencia se calcula SIEMPRE desde `scheduled_at`, así que "cada mes"
-- desde el 31 de enero da 28 feb, 31 mar, 30 abr… sin deriva.
--
-- `scheduled_at` pasa a significar el INICIO de la serie (antes era "la única salida").

ALTER TABLE gcc_world.flow_campaigns
  ADD COLUMN IF NOT EXISTS schedule_kind VARCHAR(12),
  ADD COLUMN IF NOT EXISTS freq_unit     VARCHAR(10),
  ADD COLUMN IF NOT EXISTS freq_interval INT,
  ADD COLUMN IF NOT EXISTS recur_until   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_run_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS run_count     INT NOT NULL DEFAULT 0;

-- Backfill: lo que ya estuviera programado pasa a ser "una sola vez" con la misma fecha.
UPDATE gcc_world.flow_campaigns
   SET schedule_kind = 'once',
       next_run_at   = scheduled_at
 WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND schedule_kind IS NULL;

-- Las ya enviadas cuentan como una salida hecha, para que un "una sola vez" no reviva.
UPDATE gcc_world.flow_campaigns
   SET run_count = 1
 WHERE status = 'sent' AND run_count = 0;

-- El disparador busca por `next_run_at`: índice sobre las que tienen algo pendiente.
CREATE INDEX IF NOT EXISTS flow_campaigns_next_run_idx
  ON gcc_world.flow_campaigns (next_run_at)
  WHERE next_run_at IS NOT NULL;

-- El índice de la 025 filtraba por status y ya no es el criterio del cron.
DROP INDEX IF EXISTS gcc_world.flow_campaigns_scheduled_idx;
