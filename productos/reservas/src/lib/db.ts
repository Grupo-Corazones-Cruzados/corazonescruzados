import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// El esquema se declara en DOS sitios que tienen que decir lo mismo: el
// search_path del pool (para el SQL crudo) y el adaptador (para Prisma). Sale de
// la cadena de conexión para que no haya una tercera copia.
const ESQUEMA = new URL(process.env.DATABASE_URL || 'postgresql://x/y?schema=reservas')
  .searchParams.get('schema') || 'reservas';

const global_ = globalThis as unknown as { prisma?: PrismaClient; pool?: pg.Pool };

function crear() {
  // ⚠️ LA CADENA SE PASA ENTERA, CON SU `?schema=`. `pg` ignora los parámetros que
  // no conoce —comprobado: migraciones, semilla y toda la aplicación corren con
  // esa cadena—, y el esquema lo fija el `search_path` de abajo.
  //
  // NO recortar el parámetro con `replace(/[?&]schema=[^&]+/, '')`, que es lo que
  // hace la plataforma: con un solo parámetro funciona, pero con dos se lleva por
  // delante el «?» y `...railway?schema=reservas&sslmode=disable` se convierte en
  // la base «railway&sslmode=disable», que no existe. Se probó en producción y
  // tiró todas las páginas que tocan la base (P1003).
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${ESQUEMA},public`,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: ESQUEMA }) });
  return { prisma, pool };
}

if (!global_.prisma) {
  const { prisma, pool } = crear();
  global_.prisma = prisma;
  global_.pool = pool;
}

export const prisma = global_.prisma!;
export const pool = global_.pool!;
export const esquema = ESQUEMA;
