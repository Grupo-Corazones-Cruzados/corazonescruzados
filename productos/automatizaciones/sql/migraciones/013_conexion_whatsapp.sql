-- 013 — CUÁNDO SE CONECTÓ EL NÚMERO.
--
-- ── POR QUÉ (Fernando, 2026-11-07) ──────────────────────────────────────────────
-- La conexión con WhatsApp pasa a hacerse desde Configuración ▸ WhatsApp del propio
-- inquilino. Tras el alta, Meta deja pedir la agenda de contactos del cliente UNA vez
-- y SOLO durante las 24 horas siguientes. Para saber si el plazo sigue abierto hace
-- falta la hora del alta, y `creado_en` no lo es: el canal se crea antes de conectar
-- y puede reconectarse.
--
-- Los canales que ya existen se quedan a NULL: se conectaron hace semanas y su plazo
-- está cerrado, que es justo lo que significa NULL en la pantalla.

ALTER TABLE automatizaciones.canales
  ADD COLUMN IF NOT EXISTS conectado_en timestamptz(3);
