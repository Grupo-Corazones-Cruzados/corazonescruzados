import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false} });
await c.connect();
const r = await c.query(`SELECT COUNT(*) FILTER (WHERE texto IS NOT NULL AND texto <> '')::int hechos,
                                COUNT(*)::int total
                           FROM gcc_world.agente_mensajes
                          WHERE direccion='saliente' AND herramienta='equipo' AND tipo IN ('audio','voice')`);
console.log(JSON.stringify(r.rows[0]));
const m = await c.query(`SELECT LEFT(texto,90) t FROM gcc_world.agente_mensajes
                          WHERE direccion='saliente' AND herramienta='equipo' AND tipo IN ('audio','voice')
                            AND texto IS NOT NULL AND texto <> '' ORDER BY id DESC LIMIT 3`);
for (const x of m.rows) console.log('  ·', x.t);
await c.end();
