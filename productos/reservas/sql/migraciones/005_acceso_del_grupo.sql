-- ACCESO DEL GRUPO (Fernando, 2026-09-16): un inquilino «ya comprado» para la
-- administración del Grupo Corazones Cruzados, sin mensualidad ni topes ni purga.
-- Todos los demás pasan por la suscripción.
ALTER TABLE "inquilinos" ADD COLUMN "cortesia" BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN "inquilinos"."cortesia" IS 'Acceso del grupo: sin mensualidad, sin topes, sin purga. Lo administra el equipo GCC.';
