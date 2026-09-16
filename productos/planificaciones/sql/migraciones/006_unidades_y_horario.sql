-- UNIDADES Y HORARIO (Fernando, 2026-09-16): grados de la institución, materias por
-- grado con sus docentes, y el horario semanal de cada docente (07:00–15:00, lunes a
-- viernes). De él salen los periodos de cada planificación semanal.
ALTER TABLE "planificaciones" ADD COLUMN "materia_grado_id" INTEGER;

-- CreateTable
CREATE TABLE "grados" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materias_grado" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "grado_id" INTEGER NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" TEXT,
    "unidades" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materias_grado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materias_docentes" (
    "id" SERIAL NOT NULL,
    "materia_grado_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "materias_docentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horario_clases" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "hora" INTEGER NOT NULL,
    "materia_grado_id" INTEGER,

    CONSTRAINT "horario_clases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grados_inquilino_id_nombre_key" ON "grados"("inquilino_id", "nombre");

-- CreateIndex
CREATE INDEX "materias_grado_inquilino_id_idx" ON "materias_grado"("inquilino_id");

-- CreateIndex
CREATE UNIQUE INDEX "materias_grado_grado_id_nombre_key" ON "materias_grado"("grado_id", "nombre");

-- CreateIndex
CREATE INDEX "materias_docentes_usuario_id_idx" ON "materias_docentes"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "materias_docentes_materia_grado_id_usuario_id_key" ON "materias_docentes"("materia_grado_id", "usuario_id");

-- CreateIndex
CREATE INDEX "horario_clases_materia_grado_id_idx" ON "horario_clases"("materia_grado_id");

-- CreateIndex
CREATE UNIQUE INDEX "horario_clases_usuario_id_dia_hora_key" ON "horario_clases"("usuario_id", "dia", "hora");

-- AddForeignKey
ALTER TABLE "grados" ADD CONSTRAINT "grados_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materias_grado" ADD CONSTRAINT "materias_grado_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materias_grado" ADD CONSTRAINT "materias_grado_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materias_docentes" ADD CONSTRAINT "materias_docentes_materia_grado_id_fkey" FOREIGN KEY ("materia_grado_id") REFERENCES "materias_grado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materias_docentes" ADD CONSTRAINT "materias_docentes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario_clases" ADD CONSTRAINT "horario_clases_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario_clases" ADD CONSTRAINT "horario_clases_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario_clases" ADD CONSTRAINT "horario_clases_materia_grado_id_fkey" FOREIGN KEY ("materia_grado_id") REFERENCES "materias_grado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planificaciones" ADD CONSTRAINT "planificaciones_materia_grado_id_fkey" FOREIGN KEY ("materia_grado_id") REFERENCES "materias_grado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
