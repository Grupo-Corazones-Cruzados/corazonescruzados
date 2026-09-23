-- 009_precision_de_las_fechas — que el modelo y la base digan LO MISMO
--
-- La 008 convirtió las columnas a `timestamptz` (sin precisión, o sea microsegundos) y el
-- modelo declara `@db.Timestamptz(3)` (milisegundos, que es lo que Prisma lee de todos
-- modos). Mientras no coincidan, `prisma migrate diff` propone este cambio CADA VEZ, y un
-- diff con ruido es un diff que alguien acaba aplicando entero sin mirar — llevándose por
-- delante los índices parciales y los defectos de la 007.
--
-- Truncar a milisegundos no pierde nada útil: las fechas migradas venían de objetos Date
-- de JavaScript, que ya son milisegundos.

ALTER TABLE "automatizaciones" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "campana_envios" ALTER COLUMN "enviado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "campana_listas" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "campanas" ALTER COLUMN "programada_para" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "repetir_hasta" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "proxima_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "enviada_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "envio_iniciado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "canales" ALTER COLUMN "ultimo_error_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "contactos_sincronizados_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "historial_sincronizado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "cola" ALTER COLUMN "ejecutar_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "reclamado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "conocimiento" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "contactos" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "contactos_lista" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "conversaciones" ALTER COLUMN "tomada_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "ultimo_mensaje_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "envios" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "terminado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "eventos_webhook" ALTER COLUMN "recibido_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "inquilinos" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "listas_contactos" ALTER COLUMN "compartida_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "mensajes" ALTER COLUMN "ubicacion_resuelta_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "medio_resuelto_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "operadores_gcc" ALTER COLUMN "ultimo_acceso" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "pagos_mensuales" ALTER COLUMN "pagado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "planes" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "plantilla_listas" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "plantillas_agente" ALTER COLUMN "sincronizado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "plantillas_wa" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "prompts" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "purgas" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "suscripciones" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "uso_modelo" ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER TABLE "usuarios" ALTER COLUMN "ultimo_acceso" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "creado_en" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "actualizado_en" SET DATA TYPE TIMESTAMPTZ(3);
ALTER INDEX "canales_automatizacion_id_uq" RENAME TO "canales_automatizacion_id_key";
ALTER INDEX "plantillas_agente_canal_nombre_idioma_uq" RENAME TO "plantillas_agente_canal_id_nombre_idioma_key";
