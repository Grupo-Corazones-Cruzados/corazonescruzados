-- LAS DESTREZAS SON DE CADA MATERIA DE UN GRADO Y LAS GESTIONA EL ADMINISTRADOR EN
-- «UNIDADES» (Fernando, 2026-09-17). Las planificaciones de esa materia las usan tal
-- cual (solo las ven). Las copias por planificación de antes se conservan para las
-- planificaciones sin materia asignada. El grado gana su nivel.
ALTER TABLE "grados" ADD COLUMN "nivel" "nivel" NOT NULL DEFAULT 'PREPARATORIA';
ALTER TABLE "destrezas" ADD COLUMN "materia_grado_id" INTEGER;
ALTER TABLE "destrezas" ADD CONSTRAINT "destrezas_materia_grado_id_fkey"
  FOREIGN KEY ("materia_grado_id") REFERENCES "materias_grado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "destrezas_materia_grado_id_orden_idx" ON "destrezas"("materia_grado_id", "orden");
CREATE UNIQUE INDEX "destrezas_materia_grado_codigo_unico" ON "destrezas"("materia_grado_id", "codigo") WHERE "materia_grado_id" IS NOT NULL;

-- Cada materia de grado que ya existe recibe las destrezas del catálogo de su nombre
-- (las de la institución mandan sobre las comunes), con su icono.
INSERT INTO "destrezas" ("inquilino_id", "materia_grado_id", "nivel", "materia", "codigo", "descripcion", "imagen_url", "activa", "orden")
SELECT mg."inquilino_id", mg."id", g."nivel", mg."nombre", c."codigo", c."descripcion", c."imagen_url", true, c."orden"
FROM "materias_grado" mg
JOIN "grados" g ON g."id" = mg."grado_id"
JOIN LATERAL (
  SELECT DISTINCT ON (d."codigo") d."codigo", d."descripcion", d."imagen_url", d."orden"
  FROM "destrezas" d
  WHERE d."planificacion_id" IS NULL AND d."materia_grado_id" IS NULL AND d."activa"
    AND lower(d."materia") = lower(mg."nombre") AND d."nivel" = g."nivel"
    AND (d."inquilino_id" IS NULL OR d."inquilino_id" = mg."inquilino_id")
  ORDER BY d."codigo", (d."inquilino_id" IS NOT NULL) DESC
) c ON true;
