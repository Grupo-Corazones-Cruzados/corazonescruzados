#!/usr/bin/env node
/**
 * REPARAR LOS MENSAJES MAL ETIQUETADOS.
 *
 *   node scripts/reparar-etiquetas.mjs --contar   → solo mira
 *   node scripts/reparar-etiquetas.mjs            → repara
 *
 * ── QUÉ PASÓ ─────────────────────────────────────────────────────────────────────
 * `extraerMensajes` tenía una COPIA de la lógica de texto que no conocía la tabla de
 * etiquetas. Así, todo lo que no fuera texto plano llegaba en blanco, `medios.ts`
 * intentaba resolverlo como si fuera un archivo y lo dejaba escrito como
 * «[El cliente envió algo que no es texto (tipo)]».
 *
 * 996 mensajes en Peter Tours, y **415 de ellos eran ubicaciones compartidas** — el dato
 * más útil que le puede mandar un cliente a una empresa de transporte. El agente
 * respondía disculpándose por no poder leer imágenes.
 *
 * ── POR QUÉ SE REPARA EL HISTÓRICO Y NO SOLO EL CÓDIGO ───────────────────────────
 * Porque el agente LEE el historial para responder. Mientras esas 996 líneas digan «el
 * cliente envió algo que no es texto», seguirán confundiéndolo en cada conversación
 * antigua que retome. Y el dato bueno no se perdió: está en el `payload` que se guardó
 * crudo, así que no hay que adivinar nada.
 *
 * ⚠️ Solo toca los mensajes con esa etiqueta exacta. No reescribe nada que un humano o el
 * modelo hayan escrito.
 */
import 'dotenv/config';
import pg from 'pg';

const soloContar = process.argv.includes('--contar');

if (!process.env.DATABASE_URL) {
  console.error('✖ Falta DATABASE_URL (.env)');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c search_path=automatizaciones,public',
});

/** Las mismas etiquetas que usa `entrante.ts`. Si cambian allí, cambian aquí. */
const SIN_TEXTO = {
  sticker: '[sticker]',
  contacts: '[contacto compartido]',
  reaction: '[reacción]',
  video: '[video]',
  document: '[documento]',
  location: '[ubicación]',
  unsupported: '[mensaje no admitido]',
  system: '[aviso de WhatsApp]',
  media_placeholder: '[archivo no disponible]',
  // Estos dos NO deberían haberse guardado nunca —son cambios sobre un mensaje anterior,
  // y el arreglo los descarta a partir de ahora—, pero los 206 que ya entraron se quedan
  // en el historial: al menos que digan lo que son.
  edit: '[mensaje editado]',
  revoke: '[mensaje eliminado]',
};

/** Lo que debería decir el mensaje, sacado de lo que mandó Meta. */
function textoBueno(tipo, p) {
  if (!p) return SIN_TEXTO[tipo] ?? null;
  // Una ubicación con nombre o dirección vale mucho más que «[ubicación]».
  if (tipo === 'location') {
    const l = p.location ?? {};
    const propio = l.name || l.address || null;
    return propio ? `[ubicación] ${propio}` : '[ubicación]';
  }
  if (tipo === 'video' || tipo === 'document') {
    const pie = p?.[tipo]?.caption ?? null;
    const nombre = tipo === 'document' ? (p.document?.filename ?? null) : null;
    return pie || (nombre ? `[documento] ${nombre}` : SIN_TEXTO[tipo]);
  }
  if (tipo === 'contacts') {
    const n = p.contacts?.[0]?.name?.formatted_name ?? null;
    return n ? `[contacto compartido] ${n}` : SIN_TEXTO.contacts;
  }
  if (tipo === 'reaction') {
    const e = p.reaction?.emoji ?? null;
    return e ? `[reacción] ${e}` : SIN_TEXTO.reaction;
  }
  if (tipo === 'edit') {
    // Una edición trae el texto nuevo: vale más que la etiqueta.
    const t = p?.edit?.text?.body ?? p?.text?.body ?? null;
    return t ? `[mensaje editado] ${t}` : SIN_TEXTO.edit;
  }
  if (tipo === 'system') {
    const b = p.system?.body ?? null;
    return b ? `[aviso de WhatsApp] ${b}` : SIN_TEXTO.system;
  }
  return SIN_TEXTO[tipo] ?? null;
}

const MARCA = '[El cliente envió algo que no es texto';

async function main() {
  const { rows } = await pool.query(
    `SELECT id, tipo, payload FROM mensajes
      WHERE direccion = 'ENTRANTE' AND texto LIKE $1 || '%'
      ORDER BY id`,
    [MARCA],
  );

  const porTipo = {};
  for (const m of rows) porTipo[m.tipo] = (porTipo[m.tipo] ?? 0) + 1;

  if (soloContar) {
    console.log(`\n  ${rows.length} mensajes mal etiquetados:`);
    for (const [t, n] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) {
      const ejemplo = textoBueno(t, rows.find((r) => r.tipo === t)?.payload);
      console.log(`    ${String(n).padStart(4)}  ${t.padEnd(14)} → «${ejemplo}»`);
    }
    return;
  }

  let n = 0;
  for (const m of rows) {
    const bueno = textoBueno(m.tipo, m.payload);
    if (!bueno) continue;
    await pool.query(`UPDATE mensajes SET texto = $2 WHERE id = $1`, [m.id, bueno]);
    n++;
  }
  console.log(`\n✔ ${n} mensajes reetiquetados con lo que de verdad mandó el cliente.`);
  for (const [t, c] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(c).padStart(4)}  ${t}`);
  }
}

main()
  .catch((e) => { console.error('\n✖', e.message); process.exit(1); })
  .finally(() => pool.end());
