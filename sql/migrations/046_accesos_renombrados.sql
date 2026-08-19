-- ─────────────────────────────────────────────────────────────────────────────
-- LOS TRAMOS DE `/clientes` SE LLAMAN COMO LA SECCIÓN (Fernando, 2026-08-19)
--
--   requerimientos → progreso
--   votacion       → democracia
--
-- El `id` de `ACCESOS` (`lib/sitio/contenido.ts`) es TRES cosas a la vez: el tramo de la
-- URL, el valor de `generateStaticParams`, y **la clave con la que se guardan las preguntas
-- frecuentes** en esta tabla. Las dos primeras se resuelven en el código; esta es la tercera.
--
-- ⚠️ HOY ESTO NO MUEVE NI UNA FILA: `gcc_world.faqs` está vacía (comprobado contra
-- producción el 2026-08-18). Se escribe igualmente porque entre este momento y el despliegue
-- alguien puede crear una pregunta desde Admin → FAQs bajo el nombre viejo, y esa pregunta
-- quedaría huérfana: guardada, correcta, y sin salir en ninguna página. Un `UPDATE` que no
-- afecta a nada cuesta milisegundos; una FAQ perdida cuesta una investigación.
--
-- Es idempotente por construcción: si no hay filas con el nombre viejo, no hace nada, y
-- volver a ejecutarlo tampoco.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE gcc_world.faqs SET acceso_id = 'progreso'   WHERE acceso_id = 'requerimientos';
UPDATE gcc_world.faqs SET acceso_id = 'democracia' WHERE acceso_id = 'votacion';
