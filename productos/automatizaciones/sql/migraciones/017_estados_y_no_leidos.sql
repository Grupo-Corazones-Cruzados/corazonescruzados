-- 017 — LA BANDEJA COMO WHATSAPP (Fernando, 2026-11-08: «un indicador de mensajes como lo hace
-- whatsapp… quiero una interfaz igualita»).
-- · mensajes.estado: el acuse que manda Meta en `value.statuses` (sent / delivered / read /
--   failed). Llegaba por el mismo webhook y se tiraba. Son los ✓, ✓✓ y ✓✓ azules.
-- · conversaciones.visto_en: cuándo la abrió el equipo por última vez. Lo ENTRANTE posterior es
--   «no leído» (el círculo verde con la cuenta). Es del negocio, no de cada persona: como en el
--   WhatsApp Business del teléfono, que comparten todos.
ALTER TABLE automatizaciones.mensajes      ADD COLUMN IF NOT EXISTS estado   varchar(12);
ALTER TABLE automatizaciones.conversaciones ADD COLUMN IF NOT EXISTS visto_en timestamptz(3);
-- Lo que ya había se da por visto: si no, todas las conversaciones viejas saldrían «sin leer».
UPDATE automatizaciones.conversaciones SET visto_en = now() WHERE visto_en IS NULL;
