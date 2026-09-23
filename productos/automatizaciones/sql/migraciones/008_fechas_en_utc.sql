-- 008_fechas_en_utc — la mitad de las fechas estaban cinco horas corridas
--
-- 🪤 QUÉ PASÓ. Prisma mapea `DateTime` a `timestamp` **sin zona horaria**, mientras que la
-- plataforma usaba `timestamptz`. Con una columna sin zona, el valor que se guarda depende
-- de EN QUÉ ZONA ESTÉ QUIEN ESCRIBE:
--
--   · Las filas migradas las escribieron mis scripts desde un portátil en Ecuador (UTC-5),
--     así que un mensaje de las 18:39:27 UTC quedó guardado como «13:39:27».
--   · Las filas que nacen en el producto las escribe Railway, que corre en UTC, así que
--     las 19:09:36 UTC quedan como «19:09:36».
--
-- Misma columna, dos convenciones, cinco horas de diferencia. La aplicación —que corre en
-- UTC— enseñaba todo el histórico cinco horas antes de lo que pasó. Se vio al comparar el
-- reloj de la base con lo que mostraba la bandeja, no por un error: **no hay error, y eso
-- es lo que lo hace peligroso**.
--
-- La frontera resultó limpia y comprobada: lo migrado termina en 13:39:27 y lo nativo
-- empieza en 18:39:59, sin nada en medio.
--
-- ── CÓMO SE ARREGLA ──────────────────────────────────────────────────────────────
-- 1. Lo que se puede, **desde el origen**: los 29.615 mensajes migrados toman su instante
--    exacto de `gcc_world.agente_mensajes`, no un «+5 horas» calculado. Igual contactos y
--    conversaciones. Adivinar con aritmética lo que se puede copiar del original es
--    cambiar un dato exacto por uno plausible.
-- 2. Lo que no tiene origen al que volver (los mensajes sin identificador de WhatsApp) se
--    reinterpreta: `AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC'`.
-- 3. Y **todas** las columnas de fecha pasan a `timestamptz`, que es lo que impide que
--    esto vuelva a ocurrir: con zona, da igual desde dónde se escriba.
--
-- ⚠️ `actualizado_en` NO se toca: esas las escribió `now()` en la propia base, así que ya
-- estaban en UTC.

-- ── 1. Los mensajes, desde el origen ──────────────────────────────────────────
UPDATE "mensajes" m
   SET "creado_en" = (v.created_at AT TIME ZONE 'UTC')
  FROM gcc_world.agente_mensajes v
 WHERE v.wa_message_id IS NOT NULL
   AND m.wa_message_id = v.wa_message_id
   AND m.creado_en < TIMESTAMP '2026-09-23 18:39:00';

-- Los que no tienen identificador de WhatsApp (las respuestas del agente) no se pueden
-- casar con el original: se reinterpretan.
UPDATE "mensajes"
   SET "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "wa_message_id" IS NULL
   AND "creado_en" < TIMESTAMP '2026-09-23 18:39:00';

-- ── 2. Contactos y conversaciones, desde el origen ────────────────────────────
UPDATE "contactos" c
   SET "creado_en" = (v.created_at AT TIME ZONE 'UTC')
  FROM gcc_world.agente_contactos v
 WHERE c.canal_id = v.canal_id AND c.wa_id = v.wa_id
   AND c.creado_en < TIMESTAMP '2026-09-23 18:39:00';

UPDATE "conversaciones" cv
   SET "creado_en" = (v.created_at AT TIME ZONE 'UTC'),
       "tomada_en" = CASE WHEN v.tomada_en IS NULL THEN NULL ELSE (v.tomada_en AT TIME ZONE 'UTC') END
  FROM gcc_world.agente_conversaciones v
  JOIN gcc_world.agente_contactos vc ON vc.id = v.contacto_id
  JOIN "contactos" c ON c.canal_id = vc.canal_id AND c.wa_id = vc.wa_id
 WHERE cv.canal_id = v.canal_id AND cv.contacto_id = c.id
   AND cv.creado_en < TIMESTAMP '2026-09-23 18:39:00';

-- ── 3. El resto de fechas copiadas, reinterpretadas ───────────────────────────
UPDATE "canales" SET
  "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC'),
  "ultimo_error_en" = ("ultimo_error_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC'),
  "contactos_sincronizados_en" = ("contactos_sincronizados_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC'),
  "historial_sincronizado_en" = ("historial_sincronizado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';

UPDATE "automatizaciones" SET "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';
UPDATE "conocimiento" SET "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';
UPDATE "prompts" SET "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';
UPDATE "plantillas_agente" SET
  "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC'),
  "sincronizado_en" = ("sincronizado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';
UPDATE "envios" SET
  "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC'),
  "terminado_en" = ("terminado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';
UPDATE "uso_modelo" SET "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';
UPDATE "listas_contactos" SET
  "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC'),
  "compartida_en" = ("compartida_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';
UPDATE "contactos_lista" SET "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';
UPDATE "campanas" SET
  "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC'),
  "enviada_en" = ("enviada_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC'),
  "envio_iniciado_en" = ("envio_iniciado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC'),
  "programada_para" = ("programada_para" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC'),
  "proxima_en" = ("proxima_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC'),
  "repetir_hasta" = ("repetir_hasta" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';
UPDATE "campana_envios" SET "enviado_en" = ("enviado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "enviado_en" < TIMESTAMP '2026-09-23 18:39:00';
UPDATE "campana_listas" SET "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';
UPDATE "plantilla_listas" SET "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';
UPDATE "plantillas_wa" SET "creado_en" = ("creado_en" AT TIME ZONE 'America/Guayaquil' AT TIME ZONE 'UTC')
 WHERE "creado_en" < TIMESTAMP '2026-09-23 18:39:00';

-- ── 4. La fecha del último mensaje, RECALCULADA (exacta, no reinterpretada) ────
UPDATE "conversaciones" c
   SET "ultimo_mensaje_en" = m.ultimo
  FROM (SELECT conversacion_id, MAX(creado_en) ultimo FROM "mensajes" GROUP BY 1) m
 WHERE m.conversacion_id = c.id
   AND c."ultimo_mensaje_en" IS DISTINCT FROM m.ultimo;

-- ── 5. TODAS las columnas de fecha, a `timestamptz` ───────────────────────────
-- Es el arreglo de verdad: con zona, da igual desde dónde se escriba.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_name, column_name
      FROM information_schema.columns
     WHERE table_schema = 'automatizaciones'
       AND data_type = 'timestamp without time zone'
     ORDER BY table_name, column_name
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING (%I AT TIME ZONE ''UTC'')',
      r.table_name, r.column_name, r.column_name);
  END LOOP;
END $$;
