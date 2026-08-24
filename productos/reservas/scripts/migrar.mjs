#!/usr/bin/env node
/**
 * Aplica las migraciones SQL de sql/migraciones/ en orden, una sola vez cada una.
 *
 * Por qué existe teniendo Prisma: el motor de `prisma migrate` no logra abrir
 * conexión contra el proxy TCP de Railway (P1011/P1017/P1001) mientras que `pg`
 * conecta sin problema desde el mismo proceso. Así que Prisma se queda con lo
 * que no necesita red —generar el cliente tipado y generar el SQL con
 * `migrate diff`— y de aplicarlo se encarga esto, que es el mismo patrón que ya
 * usa GCC WORLD (scripts/migrate.mjs).
 *
 *   node scripts/migrar.mjs           → aplica las pendientes
 *   node scripts/migrar.mjs --estado  → solo lista, no escribe
 *
 * Las migraciones NO se borran una vez aplicadas, y editar una ya aplicada es un
 * error: el runner lo detecta por checksum y para.
 */
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import pg from 'pg';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'sql', 'migraciones');
const soloEstado = process.argv.includes('--estado');

if (!process.env.DATABASE_URL) {
  console.error('✖ Falta DATABASE_URL (.env)');
  process.exit(1);
}

// El esquema sale de la propia cadena de conexión, para que no haya dos sitios
// donde decir en cuál se trabaja.
const esquema = new URL(process.env.DATABASE_URL).searchParams.get('schema') || 'reservas';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: `-c search_path=${esquema},public`,
});

async function main() {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${esquema}"`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${esquema}"._migraciones (
      archivo    text PRIMARY KEY,
      checksum   text NOT NULL,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )
  `);

  const archivos = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query(`SELECT archivo, checksum FROM "${esquema}"._migraciones`);
  const aplicadas = new Map(rows.map((r) => [r.archivo, r.checksum]));

  let pendientes = 0;
  for (const archivo of archivos) {
    const sql = await readFile(path.join(DIR, archivo), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16);
    const previo = aplicadas.get(archivo);

    if (previo && previo !== checksum) {
      console.error(`✖ ${archivo} cambió después de aplicarse (${previo} → ${checksum}).`);
      console.error('  Crea una migración nueva en vez de editar una ya aplicada.');
      process.exit(1);
    }
    if (previo) continue;

    pendientes++;
    if (soloEstado) { console.log(`· pendiente  ${archivo}`); continue; }

    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(`SET LOCAL search_path TO "${esquema}", public`);
      await cliente.query(sql);
      await cliente.query(
        `INSERT INTO "${esquema}"._migraciones (archivo, checksum) VALUES ($1, $2)`,
        [archivo, checksum],
      );
      await cliente.query('COMMIT');
      console.log(`✔ aplicada   ${archivo}`);
    } catch (err) {
      await cliente.query('ROLLBACK');
      console.error(`✖ falló      ${archivo}\n  ${err.message}`);
      process.exit(1);
    } finally {
      cliente.release();
    }
  }

  if (pendientes === 0) console.log('✔ Sin migraciones pendientes.');
  else if (soloEstado) console.log(`\n${pendientes} pendiente(s).`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
