-- 002_operadores_gcc — la cuenta del equipo que opera el producto
--
-- Se quedó fuera de la 001 por descuido: sin ella no se puede entrar a `/gcc`, que es
-- donde se dan de alta los clientes y se registran los cobros.
--
-- ⚠️ Generada con `prisma migrate diff --from-config-datasource --to-schema`, y de su
-- salida se ha QUITADO A MANO un `DROP TABLE "_migraciones"`: esa tabla es la libreta
-- del runner (`scripts/migrar.mjs`), Prisma no la conoce y por eso la sobra. Aplicarla
-- tal cual habría borrado el registro de qué migraciones van aplicadas.

-- CreateTable
CREATE TABLE "operadores_gcc" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operadores_gcc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operadores_gcc_email_key" ON "operadores_gcc"("email");

