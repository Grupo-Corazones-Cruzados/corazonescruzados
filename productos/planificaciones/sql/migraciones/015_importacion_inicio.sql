-- Cuándo empezó la lectura del currículo de un grado: un despliegue mata el trabajo en
-- segundo plano y el grado se quedaba LEYENDO para siempre; pasados 15 minutos se
-- puede volver a importar (la importación es idempotente por ámbito).
ALTER TABLE "grados" ADD COLUMN "importacion_inicio" TIMESTAMP(3);
