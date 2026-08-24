-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "pedidos";

-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('ADMIN', 'MESERO', 'COCINERO');

-- CreateEnum
CREATE TYPE "estado_mesa" AS ENUM ('LIBRE', 'ESPERANDO_ATENCION', 'OCUPADA');

-- CreateEnum
CREATE TYPE "estado_pedido" AS ENUM ('EN_PREPARACION', 'LISTO', 'SERVIDO', 'COBRADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "estado_item" AS ENUM ('PENDIENTE', 'LISTO');

-- CreateEnum
CREATE TYPE "metodo_pago_pedido" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "estado_reserva_mesa" AS ENUM ('PENDIENTE', 'CUMPLIDA', 'CANCELADA', 'NO_PRESENTADO');

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
    "max_mesas" INTEGER,
    "max_usuarios" INTEGER,
    "max_productos" INTEGER,
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
    "aplica_iva" BOOLEAN NOT NULL DEFAULT true,
    "iva_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "precio_con_iva" BOOLEAN NOT NULL DEFAULT true,
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
    "pedidos" INTEGER NOT NULL DEFAULT 0,
    "reservas" INTEGER NOT NULL DEFAULT 0,

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
    "rol" "rol_usuario" NOT NULL DEFAULT 'MESERO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zonas" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zonas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesas" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "zona_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "capacidad" INTEGER,
    "estado" "estado_mesa" NOT NULL DEFAULT 'LIBRE',
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "foto_url" TEXT,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "mesa_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "dia" DATE NOT NULL,
    "mesero_id" INTEGER,
    "estado" "estado_pedido" NOT NULL DEFAULT 'EN_PREPARACION',
    "comensales" INTEGER,
    "notas" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "iva_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "metodo_pago" "metodo_pago_pedido",
    "listo_en" TIMESTAMP(3),
    "servido_en" TIMESTAMP(3),
    "cerrado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_items" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "producto_id" INTEGER,
    "nombre" TEXT NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "notas" TEXT,
    "estado" "estado_item" NOT NULL DEFAULT 'PENDIENTE',
    "listo_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_mesa" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "mesa_id" INTEGER NOT NULL,
    "cliente" TEXT NOT NULL,
    "telefono" TEXT,
    "personas" INTEGER,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "estado" "estado_reserva_mesa" NOT NULL DEFAULT 'PENDIENTE',
    "notas" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_mesa_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "zonas_inquilino_id_idx" ON "zonas"("inquilino_id");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_inquilino_id_nombre_key" ON "zonas"("inquilino_id", "nombre");

-- CreateIndex
CREATE INDEX "mesas_inquilino_id_estado_idx" ON "mesas"("inquilino_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "mesas_zona_id_nombre_key" ON "mesas"("zona_id", "nombre");

-- CreateIndex
CREATE INDEX "categorias_inquilino_id_idx" ON "categorias"("inquilino_id");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_inquilino_id_nombre_key" ON "categorias"("inquilino_id", "nombre");

-- CreateIndex
CREATE INDEX "productos_inquilino_id_disponible_idx" ON "productos"("inquilino_id", "disponible");

-- CreateIndex
CREATE UNIQUE INDEX "productos_inquilino_id_nombre_key" ON "productos"("inquilino_id", "nombre");

-- CreateIndex
CREATE INDEX "pedidos_inquilino_id_estado_idx" ON "pedidos"("inquilino_id", "estado");

-- CreateIndex
CREATE INDEX "pedidos_inquilino_id_cerrado_en_idx" ON "pedidos"("inquilino_id", "cerrado_en");

-- CreateIndex
CREATE INDEX "pedidos_mesa_id_estado_idx" ON "pedidos"("mesa_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_inquilino_id_dia_numero_key" ON "pedidos"("inquilino_id", "dia", "numero");

-- CreateIndex
CREATE INDEX "pedido_items_pedido_id_idx" ON "pedido_items"("pedido_id");

-- CreateIndex
CREATE INDEX "reservas_mesa_inquilino_id_desde_hasta_idx" ON "reservas_mesa"("inquilino_id", "desde", "hasta");

-- CreateIndex
CREATE INDEX "reservas_mesa_mesa_id_estado_idx" ON "reservas_mesa"("mesa_id", "estado");

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
ALTER TABLE "zonas" ADD CONSTRAINT "zonas_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "zonas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesero_id_fkey" FOREIGN KEY ("mesero_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_mesa" ADD CONSTRAINT "reservas_mesa_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_mesa" ADD CONSTRAINT "reservas_mesa_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

