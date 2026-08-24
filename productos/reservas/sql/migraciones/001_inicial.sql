-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "reservas";

-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('ADMIN', 'GERENTE', 'CONSULTA');

-- CreateEnum
CREATE TYPE "estado_inquilino" AS ENUM ('PRUEBA', 'ACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "estado_suscripcion" AS ENUM ('PRUEBA', 'ACTIVA', 'VENCIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "metodo_pago" AS ENUM ('AUTOSERVICIO', 'TARJETA');

-- CreateEnum
CREATE TYPE "estado_pago_mensual" AS ENUM ('PENDIENTE', 'PAGADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "estado_reserva" AS ENUM ('OCUPADA', 'POR_SALIR', 'FINALIZADA', 'ELIMINADA');

-- CreateEnum
CREATE TYPE "estado_pago_reserva" AS ENUM ('PENDIENTE', 'PAGADO');

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
    "max_ubicaciones" INTEGER,
    "max_suites" INTEGER,
    "max_usuarios" INTEGER,
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
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "zona_horaria" TEXT NOT NULL DEFAULT 'America/Guayaquil',
    "estado" "estado_inquilino" NOT NULL DEFAULT 'PRUEBA',
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
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "usuario" VARCHAR(60) NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "rol" "rol_usuario" NOT NULL DEFAULT 'CONSULTA',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "foto_url" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suites" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "ubicacion_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "foto_url" TEXT,
    "capacidad" INTEGER,
    "precio_noche" DECIMAL(10,2),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "suite_id" INTEGER NOT NULL,
    "cliente_nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "documento" TEXT,
    "entrada" TIMESTAMP(3) NOT NULL,
    "salida" TIMESTAMP(3) NOT NULL,
    "precio_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "anticipo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estado_pago" "estado_pago_reserva" NOT NULL DEFAULT 'PENDIENTE',
    "estado" "estado_reserva" NOT NULL DEFAULT 'OCUPADA',
    "comentarios" TEXT,
    "creado_por" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "usuarios_inquilino_id_idx" ON "usuarios"("inquilino_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_inquilino_id_usuario_key" ON "usuarios"("inquilino_id", "usuario");

-- CreateIndex
CREATE INDEX "ubicaciones_inquilino_id_idx" ON "ubicaciones"("inquilino_id");

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_inquilino_id_nombre_key" ON "ubicaciones"("inquilino_id", "nombre");

-- CreateIndex
CREATE INDEX "suites_inquilino_id_idx" ON "suites"("inquilino_id");

-- CreateIndex
CREATE UNIQUE INDEX "suites_ubicacion_id_nombre_key" ON "suites"("ubicacion_id", "nombre");

-- CreateIndex
CREATE INDEX "reservas_inquilino_id_entrada_salida_idx" ON "reservas"("inquilino_id", "entrada", "salida");

-- CreateIndex
CREATE INDEX "reservas_suite_id_estado_idx" ON "reservas"("suite_id", "estado");

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_mensuales" ADD CONSTRAINT "pagos_mensuales_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_mensuales" ADD CONSTRAINT "pagos_mensuales_suscripcion_id_fkey" FOREIGN KEY ("suscripcion_id") REFERENCES "suscripciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suites" ADD CONSTRAINT "suites_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suites" ADD CONSTRAINT "suites_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "suites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

