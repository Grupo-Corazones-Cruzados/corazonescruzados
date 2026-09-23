/** Recupera los nombres desde las cargas crudas de `smb_app_state_sync` que sí guardamos. */
import pg from 'pg';
import { extraerContactosDeAgenda } from './lib/agente/entrante.ts';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false} });
await c.connect();
const { rows } = await c.query(
  `SELECT payload FROM gcc_world.agente_eventos_webhook
    WHERE canal_id=11 AND payload->'entry'->0->'changes'->0->>'field' = 'smb_app_state_sync' ORDER BY id`);
console.log('cargas de agenda guardadas:', rows.length);

// Se junta TODO en memoria y gana la versión más alta de cada número: una sola escritura
// por contacto, y el orden de las tandas deja de importar.
const mejor = new Map();
for (const r of rows) {
  for (const ct of extraerContactosDeAgenda(r.payload).contactos) {
    const p = mejor.get(ct.waId);
    if (!p || ct.version >= p.version) mejor.set(ct.waId, ct);
  }
}
console.log('contactos con nombre recuperables:', mejor.size);

let n = 0;
for (const ct of mejor.values()) {
  await c.query(
    `INSERT INTO gcc_world.agente_contactos (canal_id, wa_id, nombre_agenda) VALUES (11, $1, $2)
     ON CONFLICT (canal_id, wa_id) DO UPDATE SET nombre_agenda = EXCLUDED.nombre_agenda, updated_at = NOW()`,
    [ct.waId, ct.nombre]);
  if (++n % 2000 === 0) console.log('  ', n, '/', mejor.size);
}
console.log('escritos:', n);
console.log('\nCON NOMBRE AHORA:', (await c.query(
  `SELECT COUNT(*)::int n FROM gcc_world.agente_contactos WHERE canal_id=11 AND nombre_agenda IS NOT NULL AND nombre_agenda <> ''`)).rows[0].n);
await c.end();
