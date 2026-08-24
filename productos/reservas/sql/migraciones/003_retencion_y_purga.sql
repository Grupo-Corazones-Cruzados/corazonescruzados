-- RETENCIÓN Y PURGA DE FIN DE MES.
--
-- El plan dice cuántos meses de histórico conserva un alojamiento. La limpieza
-- corre en la última hora del último día del mes (hora del alojamiento) y borra
-- lo que TERMINÓ antes del mes que acaba.
--
-- ⚠️ SE PURGA POR LA FECHA DE SALIDA, NO POR LA DE CREACIÓN. Una reserva anotada
-- el 20 de agosto para el 10 de octubre seguiría viva el 30 de septiembre: mirar
-- la fecha de alta la habría borrado y el hotel habría perdido una reserva sin
-- enterarse. Lo que aún no ha terminado no se toca.

ALTER TABLE "planes"
  ADD COLUMN IF NOT EXISTS "meses_retencion" integer DEFAULT 1;

COMMENT ON COLUMN "planes"."meses_retencion" IS
  'Meses de histórico que conserva el plan. NULO = sin límite. Con 1, la purga de fin de mes deja solo el mes en curso.';

-- Constancia de cada limpieza: un borrado automático sin rastro es indistinguible
-- de una pérdida de datos.
CREATE TABLE IF NOT EXISTS "purgas" (
  "id"           bigserial PRIMARY KEY,
  "inquilino_id" bigint NOT NULL REFERENCES "inquilinos"("id") ON DELETE CASCADE,
  "ejecutada_en" timestamptz NOT NULL DEFAULT now(),
  "corte"        date NOT NULL,
  "reservas"     integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "purgas_inquilino_fecha_idx"
  ON "purgas" ("inquilino_id", "ejecutada_en");

-- El plan que ya existe conserva un mes, que es lo acordado.
UPDATE "planes" SET "meses_retencion" = 1 WHERE "meses_retencion" IS NULL;
