-- CADA GRADO TIENE UN COLOR DE RELLENO (Fernando, 2026-09-16): se asigna al azar al
-- crearlo y sirve para distinguir el grado de la materia en los controles de
-- selección (el horario, las celdas, los chips). Los grados que ya existían reciben
-- uno de la misma paleta según su id.
ALTER TABLE "grados" ADD COLUMN "color" VARCHAR(7) NOT NULL DEFAULT '#C4B5FD';
UPDATE "grados" SET "color" = (ARRAY['#FCA5A5','#FDBA74','#FCD34D','#BEF264','#86EFAC','#5EEAD4','#7DD3FC','#A5B4FC','#C4B5FD','#F0ABFC','#F9A8D4','#D6D3D1'])[(id % 12) + 1];
