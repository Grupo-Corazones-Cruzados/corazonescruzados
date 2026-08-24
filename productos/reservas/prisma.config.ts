// La URL vive aquí (Prisma 7 ya no la acepta en el schema). El esquema del
// producto (`reservas`) va en la propia cadena: ...?schema=reservas
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // NO se usa `prisma migrate`: su motor no atraviesa el proxy TCP de Railway
  // (P1001/P1017/P1011 con `pg` conectando bien desde el mismo proceso). Las
  // migraciones son SQL versionado en sql/migraciones/ y las aplica
  // scripts/migrar.mjs, que es el patrón ya probado en GCC WORLD.
  // El SQL se GENERA desde este mismo esquema, sin tocar la base:
  //   npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
