-- 004_un_solo_plan_cinco_dolares — UN producto, 5 $/mes, con las tres cosas dentro
--
-- Fernando lo fijó el 2026-09-23: «déjalo a $5 dólares mensuales este producto nuevo para
-- que pueda acceder a las 3 cosas, por lo tanto no lo trataremos cada cosa con un costo
-- diferente, sino que el producto total vale $5 mensuales».
--
-- Deshace la separación comercial que introdujo la 003. Lo que se vende vuelve a ser UNO,
-- y las tres capacidades —agente de IA, campañas de correo y campañas de WhatsApp— van
-- incluidas. Lo que NO se deshace es la idea de que son tres cosas distintas: se sigue
-- viendo en la aplicación (qué secciones tiene un cliente depende de qué automatizaciones
-- tiene montadas), solo que ya no se cobran por separado.
--
-- ⚠️ Se puede colapsar sin perder nada porque `pagos_mensuales` está VACÍA: no hay ningún
-- cobro registrado que apunte a una de las suscripciones que se van. Comprobado antes de
-- escribir esto; si algún día hubiera pagos, habría que repuntarlos antes de borrar.

-- ── 1. Una sola suscripción por inquilino: se queda la más antigua de cada uno ──
DELETE FROM "suscripciones" s
 WHERE s.id <> (SELECT MIN(s2.id) FROM "suscripciones" s2 WHERE s2.inquilino_id = s.inquilino_id);

-- ── 2. Un solo plan, a 5,00 ────────────────────────────────────────────────────
UPDATE "planes"
   SET "nombre" = 'Estándar',
       "descripcion" = 'Agente de IA en WhatsApp, campañas de correo y campañas de WhatsApp, todo incluido.',
       "precio_mensual" = 5.00,
       "orden" = 1,
       "actualizado_en" = now()
 WHERE "id" = (SELECT MIN("id") FROM "planes");

UPDATE "suscripciones" SET "plan_id" = (SELECT MIN("id") FROM "planes");
DELETE FROM "planes" WHERE "id" <> (SELECT MIN("id") FROM "planes");

-- ── 3. Fuera la columna que separaba por producto ─────────────────────────────
DROP INDEX "suscripciones_inquilino_id_producto_key";
ALTER TABLE "suscripciones" DROP COLUMN "producto";
CREATE UNIQUE INDEX "suscripciones_inquilino_id_key" ON "suscripciones"("inquilino_id");

DROP INDEX "planes_producto_slug_key";
ALTER TABLE "planes" DROP COLUMN "producto";
CREATE UNIQUE INDEX "planes_slug_key" ON "planes"("slug");
