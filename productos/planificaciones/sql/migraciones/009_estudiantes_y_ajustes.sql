-- ESTUDIANTES Y AJUSTES RAZONABLES (Fernando, 2026-09-16): cada docente da de alta a los
-- estudiantes de sus grados; los que tienen condición especial generan una línea de
-- «Ajustes razonables» por planificación semanal. El nombre del responsable del DECE
-- pasa a ser de cada planificación (antes era del negocio): se copia el que hubiera.
-- AlterTable
ALTER TABLE "planificaciones" ADD COLUMN     "dece_nombre" VARCHAR(160);

-- CreateTable
CREATE TABLE "estudiantes" (
    "id" SERIAL NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "grado_id" INTEGER NOT NULL,
    "nombre" VARCHAR(160) NOT NULL,
    "condicion_especial" BOOLEAN NOT NULL DEFAULT false,
    "iniciales" VARCHAR(20),
    "condicion" VARCHAR(200),
    "nivel_ajuste" VARCHAR(80),
    "enfoque" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estudiantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes_razonables" (
    "id" SERIAL NOT NULL,
    "semana_id" INTEGER NOT NULL,
    "estudiante_id" INTEGER NOT NULL,
    "estrategia" TEXT NOT NULL,
    "indicadores" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ajustes_razonables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estudiantes_inquilino_id_grado_id_idx" ON "estudiantes"("inquilino_id", "grado_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajustes_razonables_semana_id_estudiante_id_key" ON "ajustes_razonables"("semana_id", "estudiante_id");

-- AddForeignKey
ALTER TABLE "estudiantes" ADD CONSTRAINT "estudiantes_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiantes" ADD CONSTRAINT "estudiantes_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_razonables" ADD CONSTRAINT "ajustes_razonables_semana_id_fkey" FOREIGN KEY ("semana_id") REFERENCES "planificaciones_semanales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_razonables" ADD CONSTRAINT "ajustes_razonables_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


UPDATE "planificaciones" p SET "dece_nombre" = i."dece_responsable" FROM "inquilinos" i WHERE i.id = p.inquilino_id AND p."dece_nombre" IS NULL AND i."dece_responsable" IS NOT NULL;

-- Escaparate: la tabla de estudiantes lleva inquilino_id; los ajustes lo heredan de su semana.
DROP TRIGGER IF EXISTS escaparate_estudiantes ON estudiantes;
CREATE TRIGGER escaparate_estudiantes BEFORE INSERT OR UPDATE OR DELETE ON estudiantes FOR EACH ROW EXECUTE FUNCTION impedir_escritura_escaparate();
