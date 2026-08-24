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
  // A `pg` se le quita el `?schema=`: es un parámetro de Prisma, no de PostgreSQL,
  // y el esquema se fija por `search_path`. Mismo tratamiento que en GCC WORLD.
  const cadena = (process.env.DATABASE_URL || '').replace(/[?&]schema=[^&]+/, '');
  const pool = new pg.Pool({
    connectionString: cadena,
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
