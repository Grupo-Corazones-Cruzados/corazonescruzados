-- 007_actualizado_en_con_defecto — `@updatedAt` vive en el CLIENTE, no en la base
--
-- 🪤 LA TRAMPA, encontrada probando el webhook con un mensaje firmado de verdad: el
-- mensaje se guardó bien pero **el trabajo no se encoló**, y el agente nunca habría
-- contestado. El error estaba tapado por el `catch` del webhook, que devuelve 200 a
-- propósito para que Meta no deshabilite la URL.
--
--     null value in column "actualizado_en" of relation "cola" violates not-null constraint
--
-- Causa: `@updatedAt` de Prisma lo rellena el CLIENTE de Prisma al escribir. La columna
-- queda NOT NULL y SIN DEFECTO en la base, así que **cualquier INSERT en SQL crudo la
-- viola**. Y este producto usa SQL crudo en todo el agente, que es justo la parte que no
-- se puede permitir fallar en silencio.
--
-- El arreglo va en la BASE y no en cada consulta: son once tablas y catorce INSERT, y
-- bastaría olvidar uno. Con un defecto, el SQL crudo funciona y Prisma sigue mandando su
-- valor en cada `update`, así que no cambia nada de lo que ya funcionaba.

ALTER TABLE "automatizaciones" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "campanas" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "canales" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "cola" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "conocimiento" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "contactos" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "conversaciones" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "inquilinos" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "planes" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "plantillas_agente" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "suscripciones" ALTER COLUMN "actualizado_en" SET DEFAULT now();
ALTER TABLE "usuarios" ALTER COLUMN "actualizado_en" SET DEFAULT now();
