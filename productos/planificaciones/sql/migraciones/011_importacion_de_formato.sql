-- IMPORTAR UN FORMATO YA HECHO (Fernando, 2026-09-17): el docente sube el PDF o Word
-- de un PUD y el agente crea la planificación y sus semanas. Mientras lee, la
-- planificación está LEYENDO; si falla, ERROR con el motivo.
ALTER TABLE "planificaciones" ADD COLUMN "importacion_estado" VARCHAR(20);
ALTER TABLE "planificaciones" ADD COLUMN "importacion_error" TEXT;
ALTER TABLE "planificaciones" ADD COLUMN "importacion_archivo" VARCHAR(200);
