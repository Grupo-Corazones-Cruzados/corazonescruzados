-- NOTAS DE VOZ E IMÁGENES: dejar constancia de que ya se intentaron leer.
--
-- Un audio o una foto llegan sin texto, así que el agente no tenía nada que responder y la
-- bandeja enseñaba un mensaje en blanco. Ahora se transcriben y se describen con la clave
-- de IA del propio cliente, y el resultado se guarda en `texto` — con lo cual el agente lo
-- trata como cualquier otro mensaje y el equipo lo lee en la bandeja.
--
-- ⚠️ ESTA COLUMNA NO ES REDUNDANTE CON `texto IS NULL`, y ese es todo su motivo.
-- Hay audios que no se pueden transcribir: ruido, tres segundos de silencio, un formato
-- raro, la clave del cliente sin saldo. Sin una marca aparte, «no se pudo» y «todavía no
-- se ha intentado» se ven exactamente igual —los dos son `texto IS NULL`— y el worker se
-- pondría a reintentar el mismo audio imposible en cada mensaje que llegue después, con su
-- descarga y su llamada de pago cada vez.
--
-- Mismo patrón que `ubicacion_resuelta_en`, que ya resolvía esto para las ubicaciones.

ALTER TABLE gcc_world.agente_mensajes
  ADD COLUMN IF NOT EXISTS medio_resuelto_en TIMESTAMPTZ;

COMMENT ON COLUMN gcc_world.agente_mensajes.medio_resuelto_en IS
  'Cuándo se intentó leer el audio o la imagen. Con valor y `texto` vacío = se intentó y no salió; no reintentar.';

-- La consulta del worker es «los medios de ESTA conversación que aún no se han intentado».
-- Parcial: solo indexa las filas pendientes, que son un puñado, no la tabla entera.
CREATE INDEX IF NOT EXISTS agente_mensajes_medios_pendientes_idx
  ON gcc_world.agente_mensajes (conversacion_id)
  WHERE medio_resuelto_en IS NULL AND direccion = 'entrante';
