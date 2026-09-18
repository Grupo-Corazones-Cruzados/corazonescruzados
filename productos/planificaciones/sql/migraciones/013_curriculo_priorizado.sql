-- IMPORTAR EL CURRÍCULO PRIORIZADO DEL MINISTERIO POR GRADO (Fernando, 2026-09-17): el
-- agente saca de ese PDF las materias (ámbitos), sus objetivos y la tabla destreza ·
-- criterio de evaluación · indicador de evaluación. El administrador SELECCIONA las
-- destrezas de cada materia (`activa`); las importadas nacen sin seleccionar.
ALTER TABLE "destrezas" ADD COLUMN "criterio" TEXT;
ALTER TABLE "destrezas" ADD COLUMN "indicador" TEXT;
ALTER TABLE "grados" ADD COLUMN "importacion_estado" VARCHAR(20);
ALTER TABLE "grados" ADD COLUMN "importacion_error" TEXT;
ALTER TABLE "grados" ADD COLUMN "importacion_archivo" VARCHAR(200);

CREATE TABLE "objetivos_materia" (
    "id" SERIAL NOT NULL,
    "materia_grado_id" INTEGER NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "objetivos_materia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "objetivos_materia_materia_grado_id_codigo_key" ON "objetivos_materia"("materia_grado_id", "codigo");
ALTER TABLE "objetivos_materia" ADD CONSTRAINT "objetivos_materia_materia_grado_id_fkey"
  FOREIGN KEY ("materia_grado_id") REFERENCES "materias_grado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
