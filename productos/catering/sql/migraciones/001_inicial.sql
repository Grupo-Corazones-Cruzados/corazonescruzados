-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catering";

-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('ADMIN', 'COCINA', 'DESPACHO');

-- CreateEnum
CREATE TYPE "dia_semana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "tipo_comida" AS ENUM ('DESAYUNO', 'MEDIA_MANANA', 'ALMUERZO', 'MEDIA_TARDE', 'CENA');

-- CreateEnum
CREATE TYPE "categoria_alimento" AS ENUM ('PROTEINA', 'CARBOHIDRATO', 'VEGETAL', 'FRUTA', 'LACTEO', 'OTRO');

-- CreateEnum
CREATE TYPE "estado_cliente" AS ENUM ('PENDIENTE', 'ACTIVO', 'INACTIVO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "estado_servicio" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "autor" AS ENUM ('CLIENTE', 'PERSONAL');

-- CreateEnum
CREATE TYPE "tipo_mensaje" AS ENUM ('SOLICITUD_INFO', 'NOTIFICACION', 'APROBACION', 'RECHAZO');

-- CreateEnum
CREATE TYPE "genero" AS ENUM ('MASCULINO', 'FEMENINO', 'OTRO');

-- CreateEnum
CREATE TYPE "actividad" AS ENUM ('SEDENTARIO', 'LEVE', 'MODERADO', 'INTENSO');

-- CreateEnum
CREATE TYPE "estado_inquilino" AS ENUM ('PRUEBA', 'ACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "estado_suscripcion" AS ENUM ('PRUEBA', 'ACTIVA', 'VENCIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "metodo_pago" AS ENUM ('AUTOSERVICIO', 'TARJETA');

-- CreateEnum
CREATE TYPE "estado_pago_mensual" AS ENUM ('PENDIENTE', 'PAGADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "tema" AS ENUM ('CLARO', 'OSCURO');

-- CreateTable
CREATE TABLE "planes" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio_mensual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "max_usuarios" INTEGER,
    "meses_retencion" INTEGER DEFAULT 1,
    "permite_marca" BOOLEAN NOT NULL DEFAULT true,
    "permite_excel" BOOLEAN NOT NULL DEFAULT true,
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
    "tipos_comida" "tipo_comida"[] DEFAULT ARRAY['ALMUERZO', 'MEDIA_TARDE', 'CENA']::"tipo_comida"[],
    "dias_servicio" "dia_semana"[] DEFAULT ARRAY['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES']::"dia_semana"[],
    "hora_limite_cancelacion" INTEGER NOT NULL DEFAULT 7,
    "porcentaje_cancelacion" INTEGER NOT NULL DEFAULT 20,
    "registro_abierto" BOOLEAN NOT NULL DEFAULT true,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "zona_horaria" TEXT NOT NULL DEFAULT 'America/Guayaquil',
    "estado" "estado_inquilino" NOT NULL DEFAULT 'PRUEBA',
    "solo_lectura" BOOLEAN NOT NULL DEFAULT false,
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
    "comprobante_url" TEXT,
    "pagado_en" TIMESTAMP(3),
    "registrado_por" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operadores_gcc" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operadores_gcc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purgas" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "ejecutada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "corte" DATE NOT NULL,
    "servicios" INTEGER NOT NULL DEFAULT 0,
    "cancelaciones" INTEGER NOT NULL DEFAULT 0,
    "menus" INTEGER NOT NULL DEFAULT 0,
    "mensajes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purgas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "usuario" VARCHAR(60) NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "rol" "rol_usuario" NOT NULL DEFAULT 'COCINA',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "edad" INTEGER,
    "facebook" TEXT,
    "instagram" TEXT,
    "tiktok" TEXT,
    "altura" DOUBLE PRECISION,
    "peso" DOUBLE PRECISION,
    "genero" "genero",
    "frecuencia_actividad" "actividad",
    "direccion" TEXT NOT NULL,
    "edificio" TEXT,
    "piso" TEXT,
    "referencias" TEXT,
    "color_identificador" VARCHAR(7),
    "direccion_2" TEXT,
    "edificio_2" TEXT,
    "piso_2" TEXT,
    "referencias_2" TEXT,
    "color_identificador_2" VARCHAR(7),
    "dias_direccion_2" "dia_semana"[] DEFAULT ARRAY[]::"dia_semana"[],
    "tipos_comida" "tipo_comida"[] DEFAULT ARRAY[]::"tipo_comida"[],
    "sin_agua" BOOLEAN NOT NULL DEFAULT false,
    "sin_fruta" BOOLEAN NOT NULL DEFAULT false,
    "sin_cubiertos" BOOLEAN NOT NULL DEFAULT false,
    "envases_propios" BOOLEAN NOT NULL DEFAULT false,
    "estado" "estado_cliente" NOT NULL DEFAULT 'PENDIENTE',
    "motorizado_id" INTEGER,
    "motorizado_2_id" INTEGER,
    "ultimo_acceso" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_restricciones" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "alimento_id" INTEGER NOT NULL,
    "tipos_comida" "tipo_comida"[] DEFAULT ARRAY[]::"tipo_comida"[],

    CONSTRAINT "cliente_restricciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alimentos" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "categoria_alimento" NOT NULL DEFAULT 'OTRO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "dias_totales" INTEGER NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "tipos_comida" "tipo_comida"[] DEFAULT ARRAY[]::"tipo_comida"[],
    "dias_semana" "dia_semana"[] DEFAULT ARRAY[]::"dia_semana"[],
    "porcentaje_cancelacion" INTEGER NOT NULL DEFAULT 20,
    "renovaciones" INTEGER NOT NULL DEFAULT 0,
    "estado" "estado_servicio" NOT NULL DEFAULT 'ACTIVO',
    "termino_en" DATE,
    "notas" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancelaciones" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "motivo" TEXT,
    "autor" "autor" NOT NULL DEFAULT 'CLIENTE',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "reactivada_en" TIMESTAMP(3),
    "reactivada_por" "autor",
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cancelaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo_comida" "tipo_comida" NOT NULL,
    "descripcion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_alimentos" (
    "id" SERIAL NOT NULL,
    "menu_id" INTEGER NOT NULL,
    "alimento_id" INTEGER NOT NULL,

    CONSTRAINT "menu_alimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motorizados" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "celular" TEXT,
    "color" VARCHAR(7),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motorizados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feriados" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "nombre" TEXT NOT NULL,
    "es_laborable" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feriados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "tipo" "tipo_mensaje" NOT NULL DEFAULT 'NOTIFICACION',
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planes_slug_key" ON "planes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "inquilinos_slug_key" ON "inquilinos"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_inquilino_id_key" ON "suscripciones"("inquilino_id");

-- CreateIndex
CREATE INDEX "pagos_mensuales_inquilino_id_periodo_idx" ON "pagos_mensuales"("inquilino_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_mensuales_suscripcion_id_periodo_key" ON "pagos_mensuales"("suscripcion_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "operadores_gcc_email_key" ON "operadores_gcc"("email");

-- CreateIndex
CREATE INDEX "purgas_inquilino_id_ejecutada_en_idx" ON "purgas"("inquilino_id", "ejecutada_en");

-- CreateIndex
CREATE INDEX "usuarios_inquilino_id_idx" ON "usuarios"("inquilino_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_inquilino_id_usuario_key" ON "usuarios"("inquilino_id", "usuario");

-- CreateIndex
CREATE INDEX "clientes_inquilino_id_estado_idx" ON "clientes"("inquilino_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_inquilino_id_email_key" ON "clientes"("inquilino_id", "email");

-- CreateIndex
CREATE INDEX "cliente_restricciones_alimento_id_idx" ON "cliente_restricciones"("alimento_id");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_restricciones_cliente_id_alimento_id_key" ON "cliente_restricciones"("cliente_id", "alimento_id");

-- CreateIndex
CREATE INDEX "alimentos_inquilino_id_activo_idx" ON "alimentos"("inquilino_id", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "alimentos_inquilino_id_nombre_key" ON "alimentos"("inquilino_id", "nombre");

-- CreateIndex
CREATE INDEX "servicios_inquilino_id_estado_idx" ON "servicios"("inquilino_id", "estado");

-- CreateIndex
CREATE INDEX "servicios_cliente_id_estado_idx" ON "servicios"("cliente_id", "estado");

-- CreateIndex
CREATE INDEX "servicios_inquilino_id_termino_en_idx" ON "servicios"("inquilino_id", "termino_en");

-- CreateIndex
CREATE INDEX "cancelaciones_inquilino_id_fecha_idx" ON "cancelaciones"("inquilino_id", "fecha");

-- CreateIndex
CREATE INDEX "cancelaciones_cliente_id_fecha_idx" ON "cancelaciones"("cliente_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "cancelaciones_servicio_id_fecha_key" ON "cancelaciones"("servicio_id", "fecha");

-- CreateIndex
CREATE INDEX "menus_inquilino_id_fecha_idx" ON "menus"("inquilino_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "menus_inquilino_id_fecha_tipo_comida_key" ON "menus"("inquilino_id", "fecha", "tipo_comida");

-- CreateIndex
CREATE INDEX "menu_alimentos_alimento_id_idx" ON "menu_alimentos"("alimento_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_alimentos_menu_id_alimento_id_key" ON "menu_alimentos"("menu_id", "alimento_id");

-- CreateIndex
CREATE INDEX "motorizados_inquilino_id_activo_idx" ON "motorizados"("inquilino_id", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "motorizados_inquilino_id_nombre_key" ON "motorizados"("inquilino_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "feriados_inquilino_id_fecha_key" ON "feriados"("inquilino_id", "fecha");

-- CreateIndex
CREATE INDEX "mensajes_cliente_id_creado_en_idx" ON "mensajes"("cliente_id", "creado_en");

-- CreateIndex
CREATE INDEX "mensajes_inquilino_id_creado_en_idx" ON "mensajes"("inquilino_id", "creado_en");

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
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_motorizado_id_fkey" FOREIGN KEY ("motorizado_id") REFERENCES "motorizados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_motorizado_2_id_fkey" FOREIGN KEY ("motorizado_2_id") REFERENCES "motorizados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_restricciones" ADD CONSTRAINT "cliente_restricciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_restricciones" ADD CONSTRAINT "cliente_restricciones_alimento_id_fkey" FOREIGN KEY ("alimento_id") REFERENCES "alimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alimentos" ADD CONSTRAINT "alimentos_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancelaciones" ADD CONSTRAINT "cancelaciones_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancelaciones" ADD CONSTRAINT "cancelaciones_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancelaciones" ADD CONSTRAINT "cancelaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_alimentos" ADD CONSTRAINT "menu_alimentos_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_alimentos" ADD CONSTRAINT "menu_alimentos_alimento_id_fkey" FOREIGN KEY ("alimento_id") REFERENCES "alimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motorizados" ADD CONSTRAINT "motorizados_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feriados" ADD CONSTRAINT "feriados_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Reglas que Prisma no sabe escribir
-- ─────────────────────────────────────────────────────────────────────────────

-- Un cliente tiene como mucho UN servicio vigente. La aplicación lo comprueba
-- antes de crear; esto lo garantiza aunque dos altas lleguen a la vez.
CREATE UNIQUE INDEX "servicios_un_vigente_por_cliente"
  ON "servicios" ("cliente_id")
  WHERE "estado" IN ('ACTIVO', 'SUSPENDIDO');
