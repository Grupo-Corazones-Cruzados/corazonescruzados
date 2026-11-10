-- 021 — LAS LLAMADAS ENTRANTES DE WHATSAPP (Cloud API Calling, Fernando, 2026-11-10).
-- Solo en números CLOUD_API (Meta no admite llamadas en coexistencia) y solo ENTRANTES.
-- Una fila por llamada (`wa_call_id` es el id de Meta: idempotente ante reintentos del webhook).
-- · estado: SONANDO → CONTESTANDO (alguien la reclamó) → EN_CURSO → TERMINADA,
--           o PERDIDA (colgó antes de que nadie contestara) · RECHAZADA · FALLIDA.
-- · sdp_oferta: la oferta WebRTC que manda Meta; el navegador de quien contesta crea la respuesta.
-- · mensaje_id: el aviso de la llamada dentro del chat («Llamada perdida», «Llamada de voz · 2:31»).
CREATE TABLE IF NOT EXISTS automatizaciones.llamadas (
  id                serial PRIMARY KEY,
  inquilino_id      integer NOT NULL REFERENCES automatizaciones.inquilinos(id) ON DELETE CASCADE,
  canal_id          integer NOT NULL REFERENCES automatizaciones.canales(id) ON DELETE CASCADE,
  conversacion_id   integer REFERENCES automatizaciones.conversaciones(id) ON DELETE CASCADE,
  mensaje_id        integer REFERENCES automatizaciones.mensajes(id) ON DELETE SET NULL,
  wa_call_id        varchar(200) NOT NULL UNIQUE,
  estado            varchar(12) NOT NULL DEFAULT 'SONANDO',
  sdp_oferta        text,
  atendida_por_id   integer REFERENCES automatizaciones.usuarios(id) ON DELETE SET NULL,
  llego_en          timestamptz(3) NOT NULL DEFAULT now(),
  contestada_en     timestamptz(3),
  terminada_en      timestamptz(3),
  duracion_segundos integer,
  error             text,
  CONSTRAINT llamadas_estado_valido CHECK (estado IN ('SONANDO','CONTESTANDO','EN_CURSO','TERMINADA','PERDIDA','RECHAZADA','FALLIDA'))
);
CREATE INDEX IF NOT EXISTS llamadas_por_estado ON automatizaciones.llamadas (inquilino_id, estado, llego_en DESC);
