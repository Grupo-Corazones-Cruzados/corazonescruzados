-- LOS DATOS DEL NEGOCIO QUE LLEVA IMPRESOS EL FORMATO (Fernando, 2026-09-16): la
-- cabecera de tres líneas, el año lectivo y los tres logos, editables por el
-- administrador en el módulo «Negocio». Y el «Registro de formato», el pie del
-- documento, que es variable por planificación.
ALTER TABLE "inquilinos"
  ADD COLUMN "cabecera_linea_1" VARCHAR(160),
  ADD COLUMN "cabecera_linea_2" VARCHAR(160),
  ADD COLUMN "cabecera_linea_3" VARCHAR(160),
  ADD COLUMN "anio_lectivo" VARCHAR(40),
  ADD COLUMN "logo_institucion_url" TEXT,
  ADD COLUMN "logo_organizacion_url" TEXT,
  ADD COLUMN "logo_opcional_url" TEXT,
  ADD COLUMN "dece_responsable" VARCHAR(160);

ALTER TABLE "planificaciones"
  ADD COLUMN "registro_titulo" VARCHAR(200),
  ADD COLUMN "registro_elaborado_cargo" VARCHAR(120) DEFAULT 'Coordinación Pedagógica',
  ADD COLUMN "registro_elaborado_nombre" VARCHAR(200),
  ADD COLUMN "registro_elaborado_fecha" VARCHAR(40),
  ADD COLUMN "registro_aprobado_cargo" VARCHAR(120) DEFAULT 'Dirección General',
  ADD COLUMN "registro_aprobado_nombre" VARCHAR(200),
  ADD COLUMN "registro_aprobado_fecha" VARCHAR(40);
