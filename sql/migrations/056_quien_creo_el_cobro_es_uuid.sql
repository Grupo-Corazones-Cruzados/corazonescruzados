-- QUIÉN CREÓ EL COBRO ES UN UUID, NO UN ENTERO (2026-08-26).
--
-- `payment_intents.created_by` y `payment_links.created_by` se declararon como `INT` en la
-- migración 053, dando por hecho que los usuarios tenían id numérico. **`gcc_world.users.id`
-- es `uuid`**, así que `Number(user.userId)` daba `NaN` y Postgres rechazaba el INSERT con
-- «invalid input syntax for type integer: "NaN"».
--
-- ⚠️ NO ERA UN FALLO DE LA TRANSFERENCIA: rompía **el cobro del cliente con sesión en los
-- cuatro orígenes**. No se vio antes porque todo lo que se había probado de punta a punta
-- pasaba por el canal del ENLACE, donde `created_by` va a NULL a propósito (quien paga por
-- un enlace no tiene cuenta). El primer cobro real —el dólar de prueba— también fue por
-- enlace. Un camino sin probar no es un camino que funcione.
--
-- Se pasa a TEXT en vez de a UUID porque también lo escriben procesos sin usuario detrás, y
-- un texto admite «cron» o «sistema» sin inventar un usuario falso para poder guardarlo.

ALTER TABLE gcc_world.payment_intents
  ALTER COLUMN created_by TYPE TEXT USING created_by::text;

ALTER TABLE gcc_world.payment_links
  ALTER COLUMN created_by TYPE TEXT USING created_by::text;

COMMENT ON COLUMN gcc_world.payment_intents.created_by IS
  'Quién abrió el cobro. TEXT porque users.id es uuid y porque hay orígenes sin usuario (NULL en el canal del enlace).';
