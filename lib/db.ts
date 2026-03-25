import { PrismaClient } from '@/lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-expect-error pg has no types
import pg from 'pg';

const globalForDb = globalThis as unknown as {
  prisma: PrismaClient;
  pool: InstanceType<typeof pg.Pool>;
};

function init() {
  const connStr = (process.env.DATABASE_URL || '').replace(/[?&]schema=[^&]+/, '');
  const pool = new pg.Pool({
    connectionString: connStr,
    // Set search_path so raw SQL queries use the correct schema
    options: '-c search_path=gcc_world,public',
  });
  const adapter = new PrismaPg(pool as any, { schema: 'gcc_world' });
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

if (!globalForDb.prisma) {
  const { prisma, pool } = init();
  globalForDb.prisma = prisma;
  globalForDb.pool = pool;
}

export const prisma = globalForDb.prisma;
export const pool = globalForDb.pool;
