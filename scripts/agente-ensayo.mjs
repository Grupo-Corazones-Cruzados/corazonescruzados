/**
 * ENSAYO EN SECO del agente: comprueba que DECIDE bien antes de conectar ningún número.
 *
 *   node scripts/agente-ensayo.mjs [canal] ["pregunta 1" "pregunta 2" …]
 *
 * No inventa un camino paralelo: usa el de verdad —cola → worker desplegado → runner— y
 * aprovecha que `mandar()` registra el mensaje saliente CON su texto aunque el envío falle
 * por no haber token. Es decir: se ve exactamente qué habría contestado, sin WhatsApp.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────────
 * La primera vez que se corrió (2026-08-01, canal de Peters Tours) devolvió **400 en las
 * seis preguntas**: `thinking` de estilo antiguo es incompatible con forzar el uso de
 * herramienta. El agente habría estado **mudo al 100 %** con un cliente real delante, y
 * ese fallo no lo caza `tsc`, ni `next build`, ni ninguna prueba que no llame de verdad a
 * la API. Este script es la cuarta verificación del repo.
 *
 * ── SEGURIDAD ──────────────────────────────────────────────────────────────────
 * Aborta si el canal ya tiene número o token de WhatsApp: ahí el ensayo mandaría mensajes
 * DE VERDAD a quien sea que figure como contacto. Solo corre sobre canales sin conectar.
 * Enciende el agente el tiempo del ensayo y lo restaura. Todo lo que crea lo borra al
 * final, y compara el inventario de antes y después para demostrarlo.
 */
import 'dotenv/config';
import pg from 'pg';

const CANAL = Number(process.argv[2] || 11);
const p = new pg.Pool({ connectionString: (process.env.DATABASE_URL || '').replace(/[?&]schema=[^&]+/, '') });

const PREGUNTAS = process.argv.slice(3).length ? process.argv.slice(3) : [
  'Hola, buenas tardes',
  '¿Cuánto cuesta el tour a Galápagos?',
  '¿Qué formas de pago aceptan?',
  '¿A qué hora atienden?',
  'Quiero reclamar, el tour de ayer fue pésimo y exijo que me devuelvan el dinero',
  'Necesito hablar con una persona por favor',
];

const inv = async () => {
  const q = async (t) => (await p.query(`select count(*)::int n from gcc_world.${t}`)).rows[0].n;
  return { contactos: await q('agente_contactos'), conv: await q('agente_conversaciones'),
           msg: await q('agente_mensajes'), cola: await q('agente_cola'), uso: await q('agente_uso_modelo') };
};

const antes = await inv();
console.log('INVENTARIO ANTES:', antes);

// Conocimiento del canal, para saber qué es razonable esperar.
const bloques = await p.query(
  `select clave, titulo, length(contenido) chars, activo from gcc_world.agente_conocimiento
    where canal_id = $1 order by orden, clave`, [CANAL]);
console.log(`\nCONOCIMIENTO del canal ${CANAL}: ${bloques.rows.length} bloques`);
console.log(bloques.rows.map(r => `  ${r.activo ? '·' : '✗'} ${r.clave} (${r.chars} car.)`).join('\n'));

// El agente está APAGADO a propósito (`bot_activo` del canal): el runner devuelve
// «omitido» y no llama al modelo. Para el ensayo se enciende y se restaura al final.
// Es seguro porque el canal NO tiene número ni token: aunque decidiera responder, no hay
// por dónde salir — el envío falla y queda registrado, que es justo lo que se quiere ver.
const { rows: [estadoPrevio] } = await p.query(
  `select bot_activo, ultimo_error from gcc_world.agente_canales where id = $1`, [CANAL]);
const { rows: [seguro] } = await p.query(
  `select phone_number_id, (wa_token_cifrado is not null) as con_token
     from gcc_world.agente_canales where id = $1`, [CANAL]);
if (seguro.phone_number_id || seguro.con_token) {
  console.error('\n⛔ ABORTA: el canal ya tiene número o token de WhatsApp. Un ensayo aquí MANDARÍA mensajes de verdad.');
  await p.end(); process.exit(1);
}
await p.query(`update gcc_world.agente_canales set bot_activo = true where id = $1`, [CANAL]);
console.log(`\nAgente encendido temporalmente para el ensayo (estaba en ${estadoPrevio.bot_activo}).`);

// Un contacto por pregunta: `agente_conversaciones` es única por (canal, contacto) —una
// persona tiene UNA conversación con el negocio—, así que dos preguntas del mismo contacto
// serían la misma conversación. Aquí interesa que cada una arranque en frío.
const contactos = [];
const resultados = [];
for (const [i, pregunta] of PREGUNTAS.entries()) {
  const { rows: [contacto] } = await p.query(
    `insert into gcc_world.agente_contactos (canal_id, wa_id, nombre_perfil)
     values ($1, $2, 'ENSAYO EN SECO') returning id`, [CANAL, `000ENSAYO${i}`]);
  contactos.push(contacto.id);
  const { rows: [conv] } = await p.query(
    `insert into gcc_world.agente_conversaciones (canal_id, contacto_id, bot_activo, ultimo_mensaje_en)
     values ($1, $2, true, NOW()) returning id`, [CANAL, contacto.id]);
  await p.query(
    `insert into gcc_world.agente_mensajes (conversacion_id, direccion, tipo, texto, wa_message_id)
     values ($1, 'entrante', 'text', $2, $3)`, [conv.id, pregunta, `ensayo-${Date.now()}-${i}`]);
  // ejecutar_en en el pasado: no hay que esperar el debounce en un ensayo.
  await p.query(
    `insert into gcc_world.agente_cola (conversacion_id, ejecutar_en)
     values ($1, NOW() - interval '1 minute')`, [conv.id]);
  resultados.push({ conv: conv.id, pregunta });
}

console.log(`\n${PREGUNTAS.length} conversaciones encoladas. Esperando al worker desplegado…`);

const espera = (ms) => new Promise(r => setTimeout(r, ms));
for (let intento = 1; intento <= 40; intento++) {
  await espera(5000);
  const { rows: [{ n }] } = await p.query(
    `select count(*)::int n from gcc_world.agente_cola
      where conversacion_id = any($1) and estado in ('pendiente','procesando')`,
    [resultados.map(r => r.conv)]);
  process.stdout.write(`\r  quedan ${n}/${PREGUNTAS.length} … (${intento * 5}s)`);
  if (n === 0) break;
}
console.log('\n');

for (const r of resultados) {
  const { rows } = await p.query(
    `select direccion, texto, herramienta, motivo, enviado_ok, error_envio
       from gcc_world.agente_mensajes where conversacion_id = $1 order by id`, [r.conv]);
  const salida = rows.filter(x => x.direccion === 'saliente');
  const { rows: [uso] } = await p.query(
    `select tokens_entrada, tokens_salida, tokens_cache_escritura, tokens_cache_lectura, duracion_ms
       from gcc_world.agente_uso_modelo where conversacion_id = $1 order by id desc limit 1`, [r.conv]);
  const { rows: [cola] } = await p.query(
    `select estado, error from gcc_world.agente_cola where conversacion_id = $1`, [r.conv]);

  console.log('─'.repeat(78));
  console.log(`👤  ${r.pregunta}`);
  if (!salida.length) {
    console.log(`🤖  (sin salida) cola=${cola?.estado} ${cola?.error ?? ''}`);
  } else for (const s of salida) {
    console.log(`🤖  [${s.herramienta}] ${s.texto ? s.texto.replace(/\n/g, '\n    ') : '(sin texto)'}`);
    if (s.motivo) console.log(`    motivo: ${s.motivo}`);
    if (s.enviado_ok === false) console.log(`    (envío no realizado — ensayo sin número: ${s.error_envio})`);
  }
  if (uso) console.log(`    tokens: entrada ${uso.tokens_entrada} · salida ${uso.tokens_salida} · caché escrito ${uso.tokens_cache_escritura} · caché leído ${uso.tokens_cache_lectura} · ${uso.duracion_ms} ms`);
}
console.log('─'.repeat(78));

// ── Limpieza ────────────────────────────────────────────────────────────────
await p.query(`delete from gcc_world.agente_contactos where id = any($1)`, [contactos]); // cascada
await p.query(
  `update gcc_world.agente_canales set bot_activo = $2, ultimo_error = null, ultimo_error_en = null where id = $1`,
  [CANAL, estadoPrevio.bot_activo]);
const { rows: [fin] } = await p.query(`select bot_activo from gcc_world.agente_canales where id = $1`, [CANAL]);
console.log(`\nAgente restaurado a bot_activo = ${fin.bot_activo} (era ${estadoPrevio.bot_activo}).`);
const despues = await inv();
console.log('\nINVENTARIO DESPUÉS:', despues);
console.log('¿Idéntico al de antes?', JSON.stringify(antes) === JSON.stringify(despues) ? '✅ sí' : '⚠️ NO');
await p.end();
