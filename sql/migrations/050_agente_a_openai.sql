-- ─────────────────────────────────────────────────────────────────────────────
-- 050 · EL AGENTE PASA DE ANTHROPIC A OPENAI (gpt-5.6-luna)
--
-- Decisión de Fernando del 2026-08-21: un solo proveedor de IA en toda la app.
-- El agente de WhatsApp era lo último que quedaba en Anthropic.
--
-- ⚠️ ESTA MIGRACIÓN BORRA LA CLAVE DE IA GUARDADA DE CADA CANAL, a propósito.
-- La clave la pone el cliente y las guardadas son de Anthropic (`sk-ant-…`): contra
-- OpenAI devuelven 401 en la primera conversación. Borrarlas es más honesto que dejar
-- guardada una credencial que ya no sirve. Fernando pedirá a cada cliente —incluido el
-- que ya está conectado— una clave de OpenAI y la pondrá él desde el Estudio.
--
-- Sin la clave el runner YA sabe qué hacer (está así desde el día uno): escala la
-- conversación a una persona y anota el motivo en el panel. Nadie se queda sin respuesta.
-- ─────────────────────────────────────────────────────────────────────────────

-- El nivel de razonamiento sustituye a la elección de modelo.
--
-- Antes el Estudio ofrecía Haiku / Sonnet / Opus, que era el mando de coste-vs-calidad de
-- cada cliente. Con un solo modelo ese mando desaparece, y el equivalente en OpenAI es
-- CUÁNTO se lo piensa. Medido el 2026-08-21 con las herramientas forzadas: los seis
-- niveles funcionan, y el gasto en razonamiento va de 0 tokens ('none') a 131 ('max').
ALTER TABLE gcc_world.agente_canales
  ADD COLUMN IF NOT EXISTS razonamiento VARCHAR(10) NOT NULL DEFAULT 'low';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agente_canales_razonamiento_chk'
  ) THEN
    ALTER TABLE gcc_world.agente_canales
      ADD CONSTRAINT agente_canales_razonamiento_chk
      CHECK (razonamiento IN ('none', 'low', 'medium', 'high', 'xhigh', 'max'));
  END IF;
END $$;

-- Los valores por defecto de la tabla, para los canales que se creen a partir de ahora.
ALTER TABLE gcc_world.agente_canales ALTER COLUMN ia_proveedor SET DEFAULT 'openai';
ALTER TABLE gcc_world.agente_canales ALTER COLUMN modelo       SET DEFAULT 'gpt-5.6-luna';

-- Y los canales que ya existen.
UPDATE gcc_world.agente_canales
   SET ia_proveedor        = 'openai',
       modelo              = 'gpt-5.6-luna',
       -- El borrado pedido. Sin marca ni aviso: Fernando la repone desde el Estudio.
       ia_api_key_cifrada  = NULL,
       -- El panel arranca limpio; el error de Anthropic que hubiera ya no significa nada.
       ultimo_error        = NULL,
       ultimo_error_en     = NULL,
       updated_at          = NOW()
 WHERE ia_proveedor <> 'openai' OR modelo <> 'gpt-5.6-luna';

-- El historial de uso NO se toca: dice con qué modelo se generó cada respuesta, y las
-- corridas viejas se hicieron con Claude de verdad. Reescribirlo sería falsear el dato.
