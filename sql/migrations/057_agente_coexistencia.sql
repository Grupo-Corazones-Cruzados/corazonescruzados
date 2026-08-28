-- COEXISTENCIA: que el agente vea lo que escribe el equipo del cliente, y que los
-- contactos se llamen como los tiene guardados el cliente.
--
-- Hasta ahora el webhook solo leía `messages`, que son los mensajes que ENTRAN. En un
-- número compartido entre el agente y personas eso deja dos agujeros que se ven desde
-- fuera: el agente contesta como si nadie hubiera respondido —porque no ve a sus
-- compañeros—, y en la bandeja los clientes salen con el nombre que ellos se pusieron en
-- WhatsApp («~», «💕💕💕», «Tn») en vez del que Peter Tours tiene en su agenda.
--
-- Meta lo resuelve con tres webhooks propios de la coexistencia:
--   · smb_message_echoes  — lo que la empresa envía desde su móvil o WhatsApp Web
--   · smb_app_state_sync  — la agenda de contactos de la empresa
--   · history             — hasta 180 días de conversaciones anteriores al alta

-- ── El nombre de la agenda del cliente ────────────────────────────────────────────────
-- Se guarda APARTE de `nombre_perfil` a propósito: son dos cosas distintas y las dos
-- valen. `nombre_perfil` es como se llama a sí mismo el cliente en WhatsApp; este es como
-- lo tiene apuntado la empresa. Al enseñarlo mandan las agendas, y si no hay, el perfil.
ALTER TABLE gcc_world.agente_contactos
  ADD COLUMN IF NOT EXISTS nombre_agenda TEXT;

COMMENT ON COLUMN gcc_world.agente_contactos.nombre_agenda IS
  'Nombre que la empresa tiene guardado para este contacto (webhook smb_app_state_sync). Manda sobre nombre_perfil al mostrarlo.';

-- ── De dónde salió cada mensaje ───────────────────────────────────────────────────────
-- `herramienta` decía qué decidió el AGENTE. Ahora un saliente puede no ser suyo, así que
-- se amplía con dos orígenes que no son decisiones de nadie:
--   · 'equipo'    — lo escribió una persona del cliente desde su WhatsApp
--   · 'historial' — venía del volcado de los 180 días previos al alta
--
-- ⚠️ El CHECK se recrea entero. Un `ADD CONSTRAINT` sin quitar el viejo deja los dos y el
-- más estricto gana en silencio: el INSERT falla y el mensaje del equipo se pierde. Ya
-- pasó con 'plantilla' (migración 032).
ALTER TABLE gcc_world.agente_mensajes
  DROP CONSTRAINT IF EXISTS agente_mensajes_herramienta_chk;

ALTER TABLE gcc_world.agente_mensajes
  ADD CONSTRAINT agente_mensajes_herramienta_chk
  CHECK (
    herramienta IS NULL OR herramienta IN (
      'responder', 'no_responder', 'escalar_a_humano', 'plantilla', 'equipo', 'historial'
    )
  );

-- ── La sincronización solo se puede pedir UNA VEZ, y dentro de 24 h ───────────────────
-- Meta da 24 horas desde el alta para pedir contactos e historial, y cada uno un solo
-- intento. Si se gasta o se pasa el plazo, la única salida es desconectar al cliente y
-- repetir el Embedded Signup entero. Por eso queda escrito en la fila: para que nadie
-- vuelva a pedirlo «por si acaso» y para poder demostrar qué se pidió y cuándo.
ALTER TABLE gcc_world.agente_canales
  ADD COLUMN IF NOT EXISTS contactos_sincronizados_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS historial_sincronizado_en  TIMESTAMPTZ;

COMMENT ON COLUMN gcc_world.agente_canales.contactos_sincronizados_en IS
  'Cuándo se pidió a Meta la agenda del cliente (POST smb_app_data). Un solo intento por alta.';
COMMENT ON COLUMN gcc_world.agente_canales.historial_sincronizado_en IS
  'Cuándo se pidió a Meta el historial de 180 días. Un solo intento por alta.';

-- Los mensajes del volcado llegan con su fecha original y en desorden. La bandeja ordena
-- por `created_at`, así que se respeta la fecha de Meta al insertarlos — y este índice es
-- el que evita que reconstruir una conversación larga cueste un escaneo entero.
CREATE INDEX IF NOT EXISTS agente_mensajes_conversacion_creado_idx
  ON gcc_world.agente_mensajes (conversacion_id, created_at);
