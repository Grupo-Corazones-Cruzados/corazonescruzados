-- El plan conserva UN AÑO de historial, no un mes (decisión de Fernando, 2026-10-13).
--
-- Llegó con Carliza Hotel, el primer cliente real del producto: un hotel necesita ver al
-- menos un año de estancias. Medido antes de decidir: una reserva ocupa ~140 bytes (unos
-- 400 con índices); un hotel de 230 reservas al mes son ~1 MB al año, y 100 hoteles así
-- ~110 MB, unos centavos al mes en Railway. Lo caro eran las fotos, y esas no van en la base.
--
-- La purga no cambia: sigue corriendo la última hora del mes y borrando lo que TERMINÓ antes
-- del corte (`calcularCorte` con `meses_retencion`); solo cambia cuántos meses mira atrás.

UPDATE "planes"
   SET "meses_retencion" = 12,
       "descripcion"     = 'Todo el sistema, sin límite de ubicaciones ni de suites. Se conserva un año de historial.',
       "caracteristicas" = array_replace("caracteristicas",
                             'Un mes de histórico: lo anterior se borra a fin de mes',
                             'Un año de historial: lo anterior se borra a fin de mes')
 WHERE "slug" = 'estandar';
