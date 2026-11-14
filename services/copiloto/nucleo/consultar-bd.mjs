#!/usr/bin/env node
/**
 * La base del negocio para la sesión de Gumdramon: `node consultar-bd.mjs "SELECT …"`. Es lo único de la
 * base a lo que esa sesión tiene permiso. Solo lectura y sin credenciales: ver `bd.mjs`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { consultarBd } from './bd.mjs';

const datos = process.env.COPILOTO_DATOS || path.join(os.homedir(), '.gcc-copiloto');
const cadena = fs.readFileSync(path.join(datos, '.env'), 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1].replace(/^["']|["']$/g, '');
// Desde 2026-11-14 la cadena es el usuario `copiloto_lectura` del M1 por el túnel local 55433 (sin SSL):
// solo lectura y sin las columnas de contraseñas, tokens y claves. Railway (con SSL) queda para quien
// aún apunte allí.
const local = /@(127\.0\.0\.1|localhost)[:/]/.test(cadena || '');
const pool = new pg.Pool({ connectionString: cadena, max: 1, ssl: local ? false : { rejectUnauthorized: false } });
try {
  console.log(JSON.stringify(await consultarBd(pool, process.argv.slice(2).join(' ')), null, 0));
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
