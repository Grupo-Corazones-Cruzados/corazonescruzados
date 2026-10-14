-- CORRESPONDENCIA DE IDS AL TRAER UN HOTEL DE OTRA APLICACIÓN (2026-10-13).
--
-- Llega con Carliza Hotel, que se muda de su servidor propio (`velmort-stays`, base en Neon)
-- a este producto. El hotel sigue trabajando en la app vieja hasta el día del corte, así que
-- la migración se REPITE: cada pasada trae lo nuevo y lo cambiado sin duplicar nada. Para eso
-- hay que recordar qué fila de aquí corresponde a cada fila de allá.
--
-- `actualizado_origen` es el `updatedAt` que tenía la fila de origen la última vez que se
-- trajo: si no cambió allá, no se toca aquí (y no se pisa lo que el hotel ya haya cambiado
-- en el producto después del corte).

CREATE TABLE IF NOT EXISTS "migracion_origen" (
  "origen"             TEXT        NOT NULL,   -- p. ej. 'velmort-stays'
  "tipo"               TEXT        NOT NULL,   -- usuario | ubicacion | suite | reserva
  "id_origen"          INTEGER     NOT NULL,
  "id_destino"         INTEGER     NOT NULL,
  "inquilino_id"       INTEGER     NOT NULL REFERENCES "inquilinos"("id") ON DELETE CASCADE,
  "actualizado_origen" TIMESTAMP(3),
  "migrado_en"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("origen", "tipo", "id_origen")
);
