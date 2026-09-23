-- 003_producto_por_flujo — lo que se vende es el TIPO DE FLUJO, no «Automatizaciones»
--
-- Fernando lo corrigió el 2026-09-23: «automatizaciones no es un producto como tal, sino
-- los tipos de flujos son los productos». Así que hay TRES productos —Agente de IA,
-- Campañas de Correo y Campañas de WhatsApp— y esta aplicación es donde se usan los tres.
--
-- Consecuencia en el modelo: un plan pertenece a un producto, y la suscripción deja de ser
-- una por inquilino para ser **una por (inquilino, producto)**. Un cliente puede tener el
-- agente pagado y las campañas no.
--
-- ⚠️ NO se usa la salida de `prisma migrate diff` tal cual: añade las dos columnas como
-- NOT NULL sin valor por defecto, y con filas ya dentro eso falla. Aquí se añaden nulables,
-- se rellenan y después se exigen.
--
-- El relleno es AGENTE_IA para todo lo que ya existe, y es correcto: el único plan que hay
-- se creó para el agente, y las dos suscripciones son la de PETER TOURS (cuyo flujo es
-- `ai_agent`) y la del grupo (cortesía, que no mira la fecha). Las otras dos suscripciones
-- del grupo las crea el script de mudanza, que sabe qué tipos de flujo tiene cada uno.

-- ── Plan: de qué producto es ──────────────────────────────────────────────────
ALTER TABLE "planes" ADD COLUMN "producto" "tipo_automatizacion";
UPDATE "planes" SET "producto" = 'AGENTE_IA' WHERE "producto" IS NULL;
ALTER TABLE "planes" ALTER COLUMN "producto" SET NOT NULL;

-- El código del plan pasa a ser único dentro de su producto: los tres pueden tener
-- su «estandar».
DROP INDEX "planes_slug_key";
CREATE UNIQUE INDEX "planes_producto_slug_key" ON "planes"("producto", "slug");

-- ── Suscripción: una por producto ─────────────────────────────────────────────
ALTER TABLE "suscripciones" ADD COLUMN "producto" "tipo_automatizacion";
UPDATE "suscripciones" SET "producto" = 'AGENTE_IA' WHERE "producto" IS NULL;
ALTER TABLE "suscripciones" ALTER COLUMN "producto" SET NOT NULL;

DROP INDEX "suscripciones_inquilino_id_key";
CREATE UNIQUE INDEX "suscripciones_inquilino_id_producto_key"
    ON "suscripciones"("inquilino_id", "producto");
