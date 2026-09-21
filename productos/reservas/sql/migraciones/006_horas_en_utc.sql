-- LAS HORAS DE LAS RESERVAS PASAN A SER INSTANTES (2026-09-20).
--
-- Hasta hoy la aplicación parseaba lo escrito en el formulario («14:00») con la
-- zona del SERVIDOR, que en Railway es UTC, y lo guardaba tal cual: 14:00 en la
-- columna significaba «14:00 en el reloj del hotel». Desde esta versión el
-- servidor convierte con `inquilinos.zona_horaria`, así que 14:00 del hotel se
-- guarda como 19:00 UTC, que es lo que Prisma entiende de un TIMESTAMP.
--
-- Se corrigen SOLO las filas que entraron por la aplicación (`creado_por` con
-- valor): las de la semilla se crearon desde un proceso en la zona del hotel y
-- ya eran instantes correctos.
UPDATE "reservas" r
SET "entrada" = (r."entrada" AT TIME ZONE i."zona_horaria") AT TIME ZONE 'UTC',
    "salida"  = (r."salida"  AT TIME ZONE i."zona_horaria") AT TIME ZONE 'UTC'
FROM "inquilinos" i
WHERE i."id" = r."inquilino_id"
  AND r."creado_por" IS NOT NULL;
