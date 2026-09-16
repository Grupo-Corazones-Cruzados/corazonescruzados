-- Planificación de Clases · esquema `planificaciones` · migración inicial.
-- Generada con `prisma migrate diff --from-empty --to-schema` y aplicada por
-- scripts/migrar.mjs (Prisma migrate no atraviesa el proxy de Railway).
--
-- La extensión pgvector ya existe en este Postgres (la usa gcc_world); se pide
-- igual por si el producto se instala en otra base. `search_path` lo fija el runner.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "planificaciones";

-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('ADMIN', 'PROFESOR');

-- CreateEnum
CREATE TYPE "nivel" AS ENUM ('PREPARATORIA', 'PRIMARIA', 'SECUNDARIA');

-- CreateEnum
CREATE TYPE "estado_semana" AS ENUM ('PENDIENTE', 'GENERANDO', 'LISTA', 'ERROR');

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
    "max_generaciones_semana" INTEGER,
    "meses_retencion" INTEGER,
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
    "plantilla_por_defecto" VARCHAR(40) NOT NULL DEFAULT 'pud',
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
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "usuario" VARCHAR(60) NOT NULL,
    "nombre" TEXT NOT NULL,
    "profesion" VARCHAR(80),
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "rol" "rol_usuario" NOT NULL DEFAULT 'PROFESOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materias" (
    "id" SERIAL NOT NULL,
    "nivel" "nivel" NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "ambito" VARCHAR(120),
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "materias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destrezas" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER,
    "nivel" "nivel" NOT NULL,
    "materia" VARCHAR(120) NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "imagen_url" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "destrezas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planificaciones" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "plantilla" VARCHAR(40) NOT NULL DEFAULT 'pud',
    "nivel" "nivel" NOT NULL,
    "materia" VARCHAR(120) NOT NULL,
    "ambito" VARCHAR(120) NOT NULL,
    "numero_unidad" INTEGER NOT NULL,
    "titulo_unidad" TEXT NOT NULL,
    "inicio_pud" DATE NOT NULL,
    "fin_pud" DATE NOT NULL,
    "grado_curso" VARCHAR(80),
    "paralelo" VARCHAR(20),
    "jornada" VARCHAR(40),
    "objetivos_unidad" TEXT,
    "criterios_evaluacion" TEXT,
    "elaborado_por" TEXT,
    "revisado_por" TEXT,
    "revisado_cargo" TEXT DEFAULT 'Coordinador de área',
    "aprobado_por" TEXT,
    "aprobado_cargo" TEXT DEFAULT 'Rector/Vicerrector',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planificaciones_semanales" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "planificacion_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "estado" "estado_semana" NOT NULL DEFAULT 'PENDIENTE',
    "error" TEXT,
    "indicaciones" TEXT NOT NULL,
    "fecha_inicio" DATE,
    "fecha_fin" DATE,
    "tema" TEXT,
    "numero_periodos" VARCHAR(40),
    "objetivos_tema" TEXT,
    "estrategias" TEXT,
    "recursos" TEXT,
    "tecnica" TEXT,
    "instrumento" TEXT,
    "referencias" JSONB,
    "uso" JSONB,
    "generada_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planificaciones_semanales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planificaciones_destrezas" (
    "id" SERIAL NOT NULL,
    "semana_id" INTEGER NOT NULL,
    "destreza_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "planificaciones_destrezas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjuntos" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "semana_id" INTEGER,
    "nombre" TEXT NOT NULL,
    "tipo" VARCHAR(120) NOT NULL,
    "tamano" INTEGER NOT NULL,
    "caracteres" INTEGER NOT NULL DEFAULT 0,
    "fragmentos" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjunto_fragmentos" (
    "id" SERIAL NOT NULL,
    "adjunto_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "embedding" vector(1536),

    CONSTRAINT "adjunto_fragmentos_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "materias_nivel_nombre_key" ON "materias"("nivel", "nombre");

-- CreateIndex
CREATE INDEX "destrezas_nivel_materia_idx" ON "destrezas"("nivel", "materia");

-- CreateIndex
CREATE UNIQUE INDEX "destrezas_nivel_codigo_inquilino_id_key" ON "destrezas"("nivel", "codigo", "inquilino_id");

-- CreateIndex
CREATE INDEX "planificaciones_inquilino_id_usuario_id_idx" ON "planificaciones"("inquilino_id", "usuario_id");

-- CreateIndex
CREATE INDEX "planificaciones_inquilino_id_creado_en_idx" ON "planificaciones"("inquilino_id", "creado_en");

-- CreateIndex
CREATE INDEX "planificaciones_semanales_inquilino_id_creado_en_idx" ON "planificaciones_semanales"("inquilino_id", "creado_en");

-- CreateIndex
CREATE INDEX "planificaciones_semanales_inquilino_id_estado_idx" ON "planificaciones_semanales"("inquilino_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "planificaciones_semanales_planificacion_id_orden_key" ON "planificaciones_semanales"("planificacion_id", "orden");

-- CreateIndex
CREATE INDEX "planificaciones_destrezas_destreza_id_idx" ON "planificaciones_destrezas"("destreza_id");

-- CreateIndex
CREATE UNIQUE INDEX "planificaciones_destrezas_semana_id_destreza_id_key" ON "planificaciones_destrezas"("semana_id", "destreza_id");

-- CreateIndex
CREATE INDEX "adjuntos_inquilino_id_semana_id_idx" ON "adjuntos"("inquilino_id", "semana_id");

-- CreateIndex
CREATE INDEX "adjuntos_usuario_id_creado_en_idx" ON "adjuntos"("usuario_id", "creado_en");

-- CreateIndex
CREATE INDEX "adjunto_fragmentos_adjunto_id_idx" ON "adjunto_fragmentos"("adjunto_id");

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
ALTER TABLE "destrezas" ADD CONSTRAINT "destrezas_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planificaciones" ADD CONSTRAINT "planificaciones_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planificaciones" ADD CONSTRAINT "planificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planificaciones_semanales" ADD CONSTRAINT "planificaciones_semanales_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planificaciones_semanales" ADD CONSTRAINT "planificaciones_semanales_planificacion_id_fkey" FOREIGN KEY ("planificacion_id") REFERENCES "planificaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planificaciones_semanales" ADD CONSTRAINT "planificaciones_semanales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planificaciones_destrezas" ADD CONSTRAINT "planificaciones_destrezas_semana_id_fkey" FOREIGN KEY ("semana_id") REFERENCES "planificaciones_semanales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planificaciones_destrezas" ADD CONSTRAINT "planificaciones_destrezas_destreza_id_fkey" FOREIGN KEY ("destreza_id") REFERENCES "destrezas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_semana_id_fkey" FOREIGN KEY ("semana_id") REFERENCES "planificaciones_semanales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjunto_fragmentos" ADD CONSTRAINT "adjunto_fragmentos_adjunto_id_fkey" FOREIGN KEY ("adjunto_id") REFERENCES "adjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Índice para la búsqueda por similitud de los fragmentos (coseno). hnsw necesita
-- pgvector >= 0.5; aquí hay 0.8.
CREATE INDEX "adjunto_fragmentos_embedding_idx" ON "adjunto_fragmentos" USING hnsw ("embedding" vector_cosine_ops);
