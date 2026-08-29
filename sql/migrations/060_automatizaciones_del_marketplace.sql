-- VENDER AUTOMATIZACIONES: comprar una deja al cliente con su flujo ya montado.
--
-- Hasta ahora el marketplace vendía PRODUCTOS (Reservas, Pedidos), que son aplicaciones
-- aparte con su propio servicio. Las AUTOMATIZACIONES son otra cosa: viven dentro de esta
-- misma plataforma, en el módulo de Automatizaciones, y lo que se compra es el derecho a
-- usar un flujo. Por eso comprar una tiene que hacer tres cosas de golpe —cobrar, crear la
-- suscripción y **dejar el flujo creado y accesible**— o el cliente paga y no ve nada.
--
-- Las tres primeras:
--   · Envío Programado de Correos Masivos ......  5 $/mes → flujo `email`
--   · Chatbot Conversacional en WhatsApp .......  20 $/mes → flujo `ai_agent` / whatsapp_business
--   · Agente de Generación de Presupuestos ......  30 $/mes → flujo `ai_agent` / presupuestos

-- ── QUÉ CLASE DE AGENTE ES ────────────────────────────────────────────────────────────
-- `flows.type` distingue email de WhatsApp de agente IA. Pero «agente IA» ya no es una
-- sola cosa: un chatbot que atiende clientes y un generador de presupuestos comparten el
-- motor y no se parecen en nada más — ni en su pantalla, ni en lo que hay que configurarles.
--
-- La categoría es lo que permite ir añadiendo clases de agente sin tocar el resto: mañana
-- entra `soporte` o `cobranzas` y solo hace falta su pantalla, no un tipo nuevo con su
-- ramificación en cada consulta. Se deja NULL en los flujos que no son agentes.
ALTER TABLE gcc_world.flows
  ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN gcc_world.flows.category IS
  'Clase de agente IA: whatsapp_business, presupuestos… NULL en los flujos que no son ai_agent.';

-- ── QUÉ APROVISIONA CADA FICHA DEL MARKETPLACE ────────────────────────────────────────
-- ⚠️ Lo declara la FICHA, no el código. La alternativa era un `switch` por título o por id
-- del ítem, y eso se rompe el día que alguien renombra «Chatbot Conversacional» o publica
-- una automatización nueva: habría que tocar el código para vender algo. Con estas dos
-- columnas, publicar una automatización nueva es rellenar una fila.
ALTER TABLE gcc_world.member_portfolio_items
  ADD COLUMN IF NOT EXISTS flow_type     TEXT,
  ADD COLUMN IF NOT EXISTS flow_category TEXT;

COMMENT ON COLUMN gcc_world.member_portfolio_items.flow_type IS
  'Tipo de flujo que se crea al comprar esta automatización (email | whatsapp | ai_agent). NULL = no aprovisiona nada.';
COMMENT ON COLUMN gcc_world.member_portfolio_items.flow_category IS
  'Categoría del flujo creado, cuando es ai_agent (whatsapp_business, presupuestos…).';

-- ── DE QUÉ SUSCRIPCIÓN VIVE ESTE FLUJO ────────────────────────────────────────────────
-- Un flujo creado por una compra depende de que esa suscripción siga pagándose. Sin este
-- enlace, dar de baja la suscripción dejaría el flujo funcionando y a nadie le constaría
-- por qué existe. No se borra en cascada a propósito: cancelar un cobro no puede llevarse
-- por delante las conversaciones de WhatsApp de un cliente.
ALTER TABLE gcc_world.flows
  ADD COLUMN IF NOT EXISTS subscription_id BIGINT;

COMMENT ON COLUMN gcc_world.flows.subscription_id IS
  'La suscripción que paga este flujo, si nació de una compra del marketplace.';

CREATE INDEX IF NOT EXISTS flows_subscription_idx ON gcc_world.flows (subscription_id)
  WHERE subscription_id IS NOT NULL;
