#!/usr/bin/env node
/**
 * Aplica las migraciones SQL de sql/migrations/ en orden, una sola vez cada una.
 *
 * Contexto: la carpeta sql/migrations/ se borró en la limpieza del 2026-06-07
 * ("migraciones ya aplicadas"), y como consecuencia el esquema de las tablas que
 * no están en Prisma pasó a existir SOLO en la base de datos de producción. El
 * parche que se usó en su lugar fue meter DDL en el hot path (un
 * ALTER TABLE ... IF NOT EXISTS por request). Este runner restaura el camino
 * correcto. Las migraciones NO se borran una vez aplicadas.
 *
 *   node scripts/migrate.mjs          → aplica las pendientes
 *   node scripts/migrate.mjs --status → solo lista el estado, no escribe
 */
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'sql', 'migrations');

dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config({ path: path.join(ROOT, '.env') });

const statusOnly = process.argv.includes('--status');

if (!process.env.DATABASE_URL) {
  console.error('✖ Falta DATABASE_URL (.env.local o .env)');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL.replace(/[?&]schema=[^&]+/, ''),
  options: '-c search_path=gcc_world,public',
});

async function main() {
  await pool.query('CREATE SCHEMA IF NOT EXISTS gcc_world');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.schema_migrations (
      filename   text PRIMARY KEY,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  let files;
  try {
    files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    console.error(`✖ No existe ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const { rows } = await pool.query('SELECT filename, checksum FROM gcc_world.schema_migrations');
  const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

  let pending = 0;
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16);
    const prev = applied.get(file);

    if (prev && prev !== checksum) {
      // Una migración ya aplicada cambió de contenido: la base de datos y el
      // repositorio dejaron de coincidir. Parar es más seguro que adivinar.
      console.error(`✖ ${file} fue modificada tras aplicarse (${prev} → ${checksum}).`);
      console.error('  Crea una migración nueva en vez de editar una ya aplicada.');
      process.exit(1);
    }
    if (prev) continue;

    pending++;
    if (statusOnly) {
      console.log(`· pendiente  ${file}`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO gcc_world.schema_migrations (filename, checksum) VALUES ($1, $2)',
        [file, checksum],
      );
      await client.query('COMMIT');
      console.log(`✔ aplicada   ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`✖ falló      ${file}\n  ${err.message}`);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  if (pending === 0) console.log('✔ Sin migraciones pendientes.');
  else if (statusOnly) console.log(`\n${pending} pendiente(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
