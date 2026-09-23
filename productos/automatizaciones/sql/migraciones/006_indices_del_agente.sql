-- 006_indices_del_agente — los índices que el modelo no supo expresar
--
-- Salieron de comparar UNO A UNO los índices de las tablas `agente_*` de la plataforma
-- con los del esquema nuevo. Trece no tenían equivalente, y cuatro de ellos NO SON DE
-- VELOCIDAD: son los que hacen que el código funcione.
--
--   · mensajes(wa_message_id) parcial y único → la IDEMPOTENCIA de la ingesta. Meta
--     reintenta un webhook cuando no recibe el 200 a tiempo; sin este índice el mismo
--     mensaje entra dos veces y el contacto recibe dos respuestas. Y ojo: el `ON CONFLICT`
--     tiene que REPETIR el `WHERE`, o Postgres no reconoce el índice y la ingesta entera
--     revienta con «no unique or exclusion constraint matching».
--   · canales(automatizacion_id) único → un canal por automatización; lo usa el
--     `ON CONFLICT` del alta.
--   · prompts(canal_id, tipo) parcial sobre los activos → una sola versión activa de cada
--     instrucción.
--   · plantillas_agente(canal_id, nombre, idioma) único → lo exige la sincronización con
--     Meta, que casa por esa terna.
--
-- Prisma no sabe declarar índices PARCIALES, así que estos tienen que vivir aquí y no
-- desaparecer del esquema: `prisma migrate diff` no los ve y tampoco los borra.

-- ── Los cuatro funcionales ────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "mensajes_wa_message_id_uq"
    ON "mensajes" ("wa_message_id") WHERE "wa_message_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "canales_automatizacion_id_uq"
    ON "canales" ("automatizacion_id");

CREATE UNIQUE INDEX IF NOT EXISTS "prompts_canal_tipo_activo_uq"
    ON "prompts" ("canal_id", "tipo") WHERE "activo";

CREATE UNIQUE INDEX IF NOT EXISTS "plantillas_agente_canal_nombre_idioma_uq"
    ON "plantillas_agente" ("canal_id", "nombre", "idioma");

-- ── Los de velocidad, en el orden en que se consultan ─────────────────────────
CREATE INDEX IF NOT EXISTS "conversaciones_canal_ultimo_idx"
    ON "conversaciones" ("canal_id", "ultimo_mensaje_en" DESC);

CREATE INDEX IF NOT EXISTS "mensajes_conversacion_creado_desc_idx"
    ON "mensajes" ("conversacion_id", "creado_en" DESC);

CREATE INDEX IF NOT EXISTS "mensajes_envio_idx" ON "mensajes" ("envio_id");

-- Los entrantes cuyo medio (audio, imagen) todavía no se ha descargado. Parcial porque
-- son un puñado entre decenas de miles.
CREATE INDEX IF NOT EXISTS "mensajes_medio_pendiente_idx"
    ON "mensajes" ("conversacion_id")
 WHERE "medio_resuelto_en" IS NULL AND "direccion" = 'ENTRANTE';

CREATE INDEX IF NOT EXISTS "eventos_webhook_recibido_desc_idx"
    ON "eventos_webhook" ("recibido_en" DESC);

CREATE INDEX IF NOT EXISTS "envios_canal_creado_desc_idx"
    ON "envios" ("canal_id", "creado_en" DESC);

CREATE INDEX IF NOT EXISTS "uso_modelo_conversacion_creado_desc_idx"
    ON "uso_modelo" ("conversacion_id", "creado_en" DESC);

CREATE INDEX IF NOT EXISTS "plantilla_listas_lista_idx" ON "plantilla_listas" ("lista_id");

CREATE INDEX IF NOT EXISTS "canales_waba_idx" ON "canales" ("waba_id");
