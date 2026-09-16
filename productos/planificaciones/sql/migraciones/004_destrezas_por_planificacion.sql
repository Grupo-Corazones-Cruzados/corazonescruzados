-- LAS DESTREZAS SON DE CADA PLANIFICACIÓN (Fernando, 2026-09-16). Al crear una
-- planificación se copian las del catálogo de su materia y nivel; desde el botón
-- «Destrezas» el docente las edita, quita o añade. Las filas sin planificacion_id
-- siguen siendo el catálogo.
ALTER TABLE "destrezas" ADD COLUMN "planificacion_id" INTEGER;
ALTER TABLE "destrezas" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "destrezas" ADD CONSTRAINT "destrezas_planificacion_id_fkey"
  FOREIGN KEY ("planificacion_id") REFERENCES "planificaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "destrezas_planificacion_id_orden_idx" ON "destrezas"("planificacion_id", "orden");

-- La unicidad por índices parciales (Prisma no los modela): en una planificación un
-- código no se repite; en el catálogo común tampoco.
ALTER TABLE "destrezas" DROP CONSTRAINT IF EXISTS "destrezas_nivel_codigo_inquilino_id_key";
DROP INDEX IF EXISTS "destrezas_nivel_codigo_inquilino_id_key";
CREATE UNIQUE INDEX "destrezas_planificacion_codigo_unico" ON "destrezas"("planificacion_id", "codigo") WHERE "planificacion_id" IS NOT NULL;
CREATE UNIQUE INDEX "destrezas_catalogo_comun_unico" ON "destrezas"("nivel", "codigo") WHERE "planificacion_id" IS NULL AND "inquilino_id" IS NULL;
