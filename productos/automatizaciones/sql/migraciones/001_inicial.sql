-- 001_inicial — Automatizaciones (producto del Grupo Corazones Cruzados)
--
-- El módulo que vivía dentro de la plataforma (`gcc_world`, sección
-- «Automatizaciones») pasa a ser un producto con su propio esquema, sus inquilinos
-- y su suscripción. Generado con:
--   npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
--
-- ⚠️ NO se edita una vez aplicada: el runner la comprueba por checksum.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "automatizaciones";

-- CreateEnum
CREATE TYPE "tema" AS ENUM ('CLARO', 'OSCURO');

-- CreateEnum
CREATE TYPE "estado_inquilino" AS ENUM ('PRUEBA', 'ACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "estado_suscripcion" AS ENUM ('PRUEBA', 'ACTIVA', 'VENCIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "metodo_pago" AS ENUM ('AUTOSERVICIO', 'TARJETA', 'APP_STORE', 'GOOGLE_PLAY');

-- CreateEnum
CREATE TYPE "estado_pago_mensual" AS ENUM ('PENDIENTE', 'PAGADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "origen_cuenta" AS ENUM ('PRODUCTO', 'GCC');

-- CreateEnum
CREATE TYPE "rol" AS ENUM ('ADMIN', 'OPERADOR', 'CONSULTA');

-- CreateEnum
CREATE TYPE "tipo_automatizacion" AS ENUM ('AGENTE_IA', 'CORREO', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "estado_automatizacion" AS ENUM ('BORRADOR', 'ACTIVA', 'PAUSADA');

-- CreateEnum
CREATE TYPE "direccion" AS ENUM ('ENTRANTE', 'SALIENTE');

-- CreateTable
CREATE TABLE "planes" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio_mensual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "max_usuarios" INTEGER,
    "max_automatizaciones" INTEGER,
    "max_conversaciones_mes" INTEGER,
    "meses_retencion" INTEGER DEFAULT 1,
    "permite_marca" BOOLEAN NOT NULL DEFAULT true,
    "caracteristicas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquilinos" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "nombre" TEXT NOT NULL,
    "logo_url" TEXT,
    "color_acento" VARCHAR(7) NOT NULL DEFAULT '#4B2D8E',
    "tema" "tema" NOT NULL DEFAULT 'CLARO',
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "zona_horaria" TEXT NOT NULL DEFAULT 'America/Guayaquil',
    "estado" "estado_inquilino" NOT NULL DEFAULT 'PRUEBA',
    "solo_lectura" BOOLEAN NOT NULL DEFAULT false,
    "cortesia" BOOLEAN NOT NULL DEFAULT false,
    "gcc_cliente_id" INTEGER,
    "contacto_nombre" TEXT,
    "contacto_email" TEXT,
    "contacto_telefono" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquilinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suscripciones" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "estado" "estado_suscripcion" NOT NULL DEFAULT 'PRUEBA',
    "inicio" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagado_hasta" DATE,
    "metodo_pago" "metodo_pago" NOT NULL DEFAULT 'AUTOSERVICIO',
    "referencia_externa" TEXT,
    "notas" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_mensuales" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "suscripcion_id" INTEGER NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "metodo" "metodo_pago" NOT NULL DEFAULT 'AUTOSERVICIO',
    "estado" "estado_pago_mensual" NOT NULL DEFAULT 'PENDIENTE',
    "referencia" TEXT,
    "pagado_en" TIMESTAMP(3),
    "registrado_por" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purgas" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "corte_hasta" DATE NOT NULL,
    "conversaciones" INTEGER NOT NULL DEFAULT 0,
    "mensajes" INTEGER NOT NULL DEFAULT 0,
    "eventos" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purgas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "usuario" VARCHAR(120) NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" VARCHAR(180),
    "origen" "origen_cuenta" NOT NULL DEFAULT 'PRODUCTO',
    "clave_hash" TEXT,
    "rol" "rol" NOT NULL DEFAULT 'OPERADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automatizaciones" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "tipo_automatizacion" NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "estado" "estado_automatizacion" NOT NULL DEFAULT 'BORRADOR',
    "config" JSONB NOT NULL DEFAULT '{}',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automatizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canales" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "automatizacion_id" INTEGER NOT NULL,
    "waba_id" VARCHAR(64),
    "phone_number_id" VARCHAR(64),
    "numero_visible" VARCHAR(40),
    "nombre_verificado" TEXT,
    "wa_token_cifrado" TEXT,
    "ia_api_key_cifrada" TEXT,
    "pin_cifrado" TEXT,
    "ia_proveedor" VARCHAR(40) NOT NULL DEFAULT 'openai',
    "modelo" VARCHAR(60) NOT NULL DEFAULT 'gpt-5.6-luna',
    "razonamiento" VARCHAR(20) NOT NULL DEFAULT 'low',
    "max_tokens" INTEGER NOT NULL DEFAULT 4096,
    "debounce_segundos" INTEGER NOT NULL DEFAULT 8,
    "ventana_mensajes" INTEGER NOT NULL DEFAULT 40,
    "bot_activo" BOOLEAN NOT NULL DEFAULT false,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'sin_conectar',
    "coexistencia_verificada" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_error" TEXT,
    "ultimo_error_en" TIMESTAMP(3),
    "contactos_sincronizados_en" TIMESTAMP(3),
    "historial_sincronizado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "canal_id" INTEGER NOT NULL,
    "wa_id" VARCHAR(40) NOT NULL,
    "nombre_perfil" TEXT,
    "nombre_agenda" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversaciones" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "canal_id" INTEGER NOT NULL,
    "contacto_id" INTEGER NOT NULL,
    "bot_activo" BOOLEAN NOT NULL DEFAULT true,
    "tomada_por_id" INTEGER,
    "tomada_en" TIMESTAMP(3),
    "motivo_escalado" TEXT,
    "resumen" TEXT,
    "resumen_hasta_id" INTEGER,
    "ultimo_mensaje_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "conversacion_id" INTEGER NOT NULL,
    "direccion" "direccion" NOT NULL,
    "wa_message_id" VARCHAR(120),
    "tipo" VARCHAR(30) NOT NULL DEFAULT 'text',
    "texto" TEXT,
    "payload" JSONB,
    "ubicacion_lat" DOUBLE PRECISION,
    "ubicacion_lng" DOUBLE PRECISION,
    "ubicacion_texto" TEXT,
    "ubicacion_resuelta_en" TIMESTAMP(3),
    "medio_resuelto_en" TIMESTAMP(3),
    "herramienta" VARCHAR(60),
    "motivo" TEXT,
    "enviado_ok" BOOLEAN,
    "error_envio" TEXT,
    "envio_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cola" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "conversacion_id" INTEGER NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "ejecutar_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "reclamado_en" TIMESTAMP(3),
    "error" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cola_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_webhook" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER,
    "canal_id" INTEGER,
    "firma_valida" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,
    "recibido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conocimiento" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "canal_id" INTEGER NOT NULL,
    "clave" VARCHAR(60) NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL DEFAULT '',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conocimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "canal_id" INTEGER NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contenido" TEXT NOT NULL DEFAULT '',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_agente" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "canal_id" INTEGER NOT NULL,
    "meta_id" VARCHAR(64),
    "nombre" VARCHAR(120) NOT NULL,
    "idioma" VARCHAR(10) NOT NULL DEFAULT 'es',
    "categoria" VARCHAR(30) NOT NULL DEFAULT 'UTILITY',
    "estado" VARCHAR(30) NOT NULL DEFAULT 'local',
    "motivo_rechazo" TEXT,
    "encabezado" TEXT,
    "cuerpo" TEXT NOT NULL,
    "pie" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "sincronizado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_agente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantilla_listas" (
    "plantilla_id" INTEGER NOT NULL,
    "lista_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantilla_listas_pkey" PRIMARY KEY ("plantilla_id","lista_id")
);

-- CreateTable
CREATE TABLE "envios" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "canal_id" INTEGER NOT NULL,
    "plantilla_id" INTEGER NOT NULL,
    "lista_id" INTEGER,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'enviando',
    "total" INTEGER NOT NULL DEFAULT 0,
    "enviados" INTEGER NOT NULL DEFAULT 0,
    "fallidos" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "lanzado_por_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminado_en" TIMESTAMP(3),

    CONSTRAINT "envios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uso_modelo" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "conversacion_id" INTEGER,
    "modelo" VARCHAR(60) NOT NULL,
    "tokens_entrada" INTEGER NOT NULL DEFAULT 0,
    "tokens_salida" INTEGER NOT NULL DEFAULT 0,
    "tokens_cache_escritura" INTEGER NOT NULL DEFAULT 0,
    "tokens_cache_lectura" INTEGER NOT NULL DEFAULT 0,
    "herramienta" VARCHAR(60),
    "duracion_ms" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uso_modelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listas_contactos" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "automatizacion_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "token_compartir" TEXT,
    "compartida_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listas_contactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos_lista" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "lista_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" VARCHAR(180),
    "telefono" VARCHAR(40),
    "cargo" VARCHAR(120),
    "desde_compartir" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contactos_lista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanas" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "automatizacion_id" INTEGER NOT NULL,
    "remitente" VARCHAR(180),
    "asunto" TEXT,
    "cuerpo_html" TEXT NOT NULL DEFAULT '',
    "pie_html" TEXT NOT NULL DEFAULT '',
    "adjuntos" JSONB NOT NULL DEFAULT '[]',
    "plantilla_wa_id" INTEGER,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'borrador',
    "programada_para" TIMESTAMP(3),
    "tipo_programa" VARCHAR(20),
    "frecuencia_unidad" VARCHAR(20),
    "frecuencia_intervalo" INTEGER,
    "repetir_hasta" TIMESTAMP(3),
    "proxima_en" TIMESTAMP(3),
    "vueltas" INTEGER NOT NULL DEFAULT 0,
    "enviada_en" TIMESTAMP(3),
    "envio_iniciado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campana_listas" (
    "campana_id" INTEGER NOT NULL,
    "lista_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campana_listas_pkey" PRIMARY KEY ("campana_id","lista_id")
);

-- CreateTable
CREATE TABLE "campana_envios" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "campana_id" INTEGER NOT NULL,
    "contacto_nombre" TEXT,
    "contacto_email" VARCHAR(180) NOT NULL,
    "resend_id" VARCHAR(120),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "error" TEXT,
    "enviado_en" TIMESTAMP(3),

    CONSTRAINT "campana_envios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_wa" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "automatizacion_id" INTEGER NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "idioma" VARCHAR(10) NOT NULL DEFAULT 'es',
    "tipo_encabezado" VARCHAR(20) NOT NULL DEFAULT 'ninguno',
    "encabezado" TEXT,
    "encabezado_archivo" TEXT,
    "cuerpo" TEXT NOT NULL,
    "pie" TEXT,
    "botones" JSONB NOT NULL DEFAULT '[]',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantillas_wa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planes_slug_key" ON "planes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "inquilinos_slug_key" ON "inquilinos"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_inquilino_id_key" ON "suscripciones"("inquilino_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_mensuales_suscripcion_id_periodo_key" ON "pagos_mensuales"("suscripcion_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_inquilino_id_usuario_key" ON "usuarios"("inquilino_id", "usuario");

-- CreateIndex
CREATE INDEX "automatizaciones_inquilino_id_idx" ON "automatizaciones"("inquilino_id");

-- CreateIndex
CREATE UNIQUE INDEX "canales_phone_number_id_key" ON "canales"("phone_number_id");

-- CreateIndex
CREATE INDEX "canales_inquilino_id_idx" ON "canales"("inquilino_id");

-- CreateIndex
CREATE INDEX "contactos_inquilino_id_idx" ON "contactos"("inquilino_id");

-- CreateIndex
CREATE UNIQUE INDEX "contactos_canal_id_wa_id_key" ON "contactos"("canal_id", "wa_id");

-- CreateIndex
CREATE INDEX "conversaciones_inquilino_id_ultimo_mensaje_en_idx" ON "conversaciones"("inquilino_id", "ultimo_mensaje_en");

-- CreateIndex
CREATE UNIQUE INDEX "conversaciones_canal_id_contacto_id_key" ON "conversaciones"("canal_id", "contacto_id");

-- CreateIndex
CREATE INDEX "mensajes_conversacion_id_creado_en_idx" ON "mensajes"("conversacion_id", "creado_en");

-- CreateIndex
CREATE INDEX "mensajes_inquilino_id_creado_en_idx" ON "mensajes"("inquilino_id", "creado_en");

-- CreateIndex
CREATE INDEX "cola_estado_ejecutar_en_idx" ON "cola"("estado", "ejecutar_en");

-- CreateIndex
CREATE INDEX "eventos_webhook_recibido_en_idx" ON "eventos_webhook"("recibido_en");

-- CreateIndex
CREATE UNIQUE INDEX "conocimiento_canal_id_clave_key" ON "conocimiento"("canal_id", "clave");

-- CreateIndex
CREATE INDEX "prompts_canal_id_tipo_activo_idx" ON "prompts"("canal_id", "tipo", "activo");

-- CreateIndex
CREATE INDEX "uso_modelo_inquilino_id_creado_en_idx" ON "uso_modelo"("inquilino_id", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "listas_contactos_token_compartir_key" ON "listas_contactos"("token_compartir");

-- CreateIndex
CREATE INDEX "listas_contactos_inquilino_id_idx" ON "listas_contactos"("inquilino_id");

-- CreateIndex
CREATE INDEX "contactos_lista_lista_id_idx" ON "contactos_lista"("lista_id");

-- CreateIndex
CREATE INDEX "contactos_lista_inquilino_id_idx" ON "contactos_lista"("inquilino_id");

-- CreateIndex
CREATE INDEX "campanas_inquilino_id_idx" ON "campanas"("inquilino_id");

-- CreateIndex
CREATE INDEX "campanas_proxima_en_idx" ON "campanas"("proxima_en");

-- CreateIndex
CREATE INDEX "campana_envios_campana_id_idx" ON "campana_envios"("campana_id");

-- CreateIndex
CREATE INDEX "plantillas_wa_inquilino_id_idx" ON "plantillas_wa"("inquilino_id");

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_mensuales" ADD CONSTRAINT "pagos_mensuales_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_mensuales" ADD CONSTRAINT "pagos_mensuales_suscripcion_id_fkey" FOREIGN KEY ("suscripcion_id") REFERENCES "suscripciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purgas" ADD CONSTRAINT "purgas_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automatizaciones" ADD CONSTRAINT "automatizaciones_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canales" ADD CONSTRAINT "canales_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canales" ADD CONSTRAINT "canales_automatizacion_id_fkey" FOREIGN KEY ("automatizacion_id") REFERENCES "automatizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_canal_id_fkey" FOREIGN KEY ("canal_id") REFERENCES "canales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_canal_id_fkey" FOREIGN KEY ("canal_id") REFERENCES "canales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_contacto_id_fkey" FOREIGN KEY ("contacto_id") REFERENCES "contactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_tomada_por_id_fkey" FOREIGN KEY ("tomada_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_envio_id_fkey" FOREIGN KEY ("envio_id") REFERENCES "envios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cola" ADD CONSTRAINT "cola_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_webhook" ADD CONSTRAINT "eventos_webhook_canal_id_fkey" FOREIGN KEY ("canal_id") REFERENCES "canales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conocimiento" ADD CONSTRAINT "conocimiento_canal_id_fkey" FOREIGN KEY ("canal_id") REFERENCES "canales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_canal_id_fkey" FOREIGN KEY ("canal_id") REFERENCES "canales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_agente" ADD CONSTRAINT "plantillas_agente_canal_id_fkey" FOREIGN KEY ("canal_id") REFERENCES "canales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantilla_listas" ADD CONSTRAINT "plantilla_listas_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "plantillas_agente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantilla_listas" ADD CONSTRAINT "plantilla_listas_lista_id_fkey" FOREIGN KEY ("lista_id") REFERENCES "listas_contactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios" ADD CONSTRAINT "envios_canal_id_fkey" FOREIGN KEY ("canal_id") REFERENCES "canales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios" ADD CONSTRAINT "envios_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "plantillas_agente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios" ADD CONSTRAINT "envios_lista_id_fkey" FOREIGN KEY ("lista_id") REFERENCES "listas_contactos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios" ADD CONSTRAINT "envios_lanzado_por_id_fkey" FOREIGN KEY ("lanzado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uso_modelo" ADD CONSTRAINT "uso_modelo_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listas_contactos" ADD CONSTRAINT "listas_contactos_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listas_contactos" ADD CONSTRAINT "listas_contactos_automatizacion_id_fkey" FOREIGN KEY ("automatizacion_id") REFERENCES "automatizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_lista" ADD CONSTRAINT "contactos_lista_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_lista" ADD CONSTRAINT "contactos_lista_lista_id_fkey" FOREIGN KEY ("lista_id") REFERENCES "listas_contactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanas" ADD CONSTRAINT "campanas_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanas" ADD CONSTRAINT "campanas_automatizacion_id_fkey" FOREIGN KEY ("automatizacion_id") REFERENCES "automatizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanas" ADD CONSTRAINT "campanas_plantilla_wa_id_fkey" FOREIGN KEY ("plantilla_wa_id") REFERENCES "plantillas_wa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campana_listas" ADD CONSTRAINT "campana_listas_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "campanas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campana_listas" ADD CONSTRAINT "campana_listas_lista_id_fkey" FOREIGN KEY ("lista_id") REFERENCES "listas_contactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campana_envios" ADD CONSTRAINT "campana_envios_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "campanas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_wa" ADD CONSTRAINT "plantillas_wa_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_wa" ADD CONSTRAINT "plantillas_wa_automatizacion_id_fkey" FOREIGN KEY ("automatizacion_id") REFERENCES "automatizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

