-- 011_suscripcion_de_la_plataforma — la suscripción del producto ES la de la plataforma
--
-- Fernando, 2026-09-23: «esta suscripción es la misma que tiene Diego Castillo o Peter
-- Tours en el módulo de suscripciones, es equivalente, es la misma, y debes buscar la
-- manera de enlazarla para que ya sea el pago se haga aquí o en el módulo de
-- suscripciones sea lo mismo».
--
-- La forma de que sean «la misma» NO es copiar el estado de un lado a otro: dos copias
-- del mismo dato se separan en cuanto una se actualiza sola, y entonces el cliente ve
-- pagado en un sitio y debiendo en el otro. La forma es que haya UN dueño —la plataforma,
-- que es donde se factura— y que el producto lo LEA.
--
-- Esta columna es ese enlace. Cuando está puesta, `pagado_hasta` de este esquema deja de
-- mandar y la puerta se decide con los pagos de `gcc_world.subscription_payments`.

ALTER TABLE "inquilinos"
  ADD COLUMN IF NOT EXISTS "gcc_suscripcion_id" INTEGER;

COMMENT ON COLUMN "inquilinos"."gcc_suscripcion_id" IS
  'La suscripción de gcc_world.subscriptions que cobra a este cliente. Si está puesta, es la que manda sobre el acceso.';

-- PETER TOURS S.A. ya tenía la suya: la número 1, «Suscripción Mensual a Servidor».
UPDATE "inquilinos" SET "gcc_suscripcion_id" = 1 WHERE "slug" = 'peter-tours';
