-- ─────────────────────────────────────────────────────────────────────────────
-- `herramienta = 'plantilla'` ES UN VALOR VÁLIDO
--
-- ── EL FALLO ──────────────────────────────────────────────────────────────────
-- La restricción de `agente_mensajes.herramienta` se escribió cuando lo único que producía
-- un saliente era el agente, y solo listaba sus tres herramientas: `responder`,
-- `no_responder` y `escalar_a_humano`. Al añadir los envíos de plantilla, el mensaje se
-- guarda con `'plantilla'` y la restricción lo rechazaba.
--
-- ── POR QUÉ SE VEÍA COMO «UN ERROR RARO QUE IGUAL FUNCIONÓ» ────────────────────
-- El orden importaba: primero se manda a WhatsApp, después se guarda el mensaje. La
-- llamada a Meta salía bien —el mensaje LLEGABA— y era el guardado el que reventaba, así
-- que el envío terminaba en error habiendo funcionado. Y el mensaje no aparecía en la
-- bandeja, que es justo donde se prometía verlo.
--
-- Lo vio Fernando el 2026-08-03. `NULL` sigue siendo válido: es lo que escribe una persona
-- a mano.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE gcc_world.agente_mensajes
  DROP CONSTRAINT IF EXISTS agente_mensajes_herramienta_chk;

ALTER TABLE gcc_world.agente_mensajes
  ADD CONSTRAINT agente_mensajes_herramienta_chk
  CHECK (herramienta IS NULL OR herramienta IN
         ('responder', 'no_responder', 'escalar_a_humano', 'plantilla'));
