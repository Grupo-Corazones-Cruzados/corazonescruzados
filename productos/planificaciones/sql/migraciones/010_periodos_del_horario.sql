-- EL HORARIO VA POR PERIODOS DE 40 MINUTOS (Fernando, 2026-09-16, con el horario real
-- de la docente): `hora` pasa a ser el NÚMERO DEL PERIODO (1 … 11, de 07:10 a 15:00,
-- receso de 09:10 a 09:40 tras el 3.º). Lo que hubiera con la escala vieja (7 … 14,
-- horas de reloj) se borra: no tiene traducción exacta y la tabla estaba vacía.
DELETE FROM "horario_clases" WHERE "hora" > 11;
COMMENT ON COLUMN "horario_clases"."hora" IS 'Número del periodo (1 … 11), ver lib/horario-tipos.ts';
