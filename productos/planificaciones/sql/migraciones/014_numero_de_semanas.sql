-- «Números de Semanas» del formato se puede fijar a mano en Configurar (Fernando,
-- 2026-09-17); nulo = se cuentan las semanas listas, como hasta ahora.
ALTER TABLE "planificaciones" ADD COLUMN "numero_semanas" INTEGER;
