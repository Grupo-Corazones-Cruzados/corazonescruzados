#!/usr/bin/env node
/**
 * EL INQUILINO DE DEMOSTRACIÓN — el que se enseña en el marketplace.
 *
 *   node scripts/sembrar-demostracion.mjs
 *
 * Idempotente: se puede correr las veces que haga falta. Si la demostración se estropea,
 * se rehace desde aquí en vez de arreglarla a mano — que es lo que la hace reproducible.
 *
 * ── ⚠️ LOS DATOS SON INVENTADOS, Y ES INNEGOCIABLE ───────────────────────────────
 * Sería más fácil y más vistoso copiar unas conversaciones de PETER TOURS. Son
 * conversaciones reales de personas reales pidiendo viajes, con sus nombres y sus
 * números. Esto va a estar en una ficha pública con la contraseña publicada al lado:
 * cualquiera que entre las leería. Así que el negocio de muestra es ficticio de cabo a
 * rabo.
 *
 * ── POR QUÉ NO TIENE NÚMERO CONECTADO ────────────────────────────────────────────
 * El canal existe con sus ajustes y su conocimiento para que se vea el estudio, pero sin
 * `phone_number_id`: un número de verdad en un escaparate con la contraseña publicada
 * sería regalar el WhatsApp de alguien. Su bandeja es histórico, no un chat vivo.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('✖ Falta DATABASE_URL (.env)');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c search_path=automatizaciones,public',
});

const SLUG = 'demo';
const CLAVE = 'GccDemo2026';          // la misma de los otros cuatro productos, a propósito

/** Un negocio ficticio: una floristería que vende y reparte a domicilio. */
const CONOCIMIENTO = [
  ['empresa', 'La floristería', `Somos Flor y Nata, floristería en Quito desde 2019.
Local: Av. Amazonas N34-120 y Juan Pablo Sanz. Abrimos de lunes a sábado de 9:00 a 19:00.
Repartimos el mismo día en todo el norte de Quito si el pedido entra antes de las 15:00.`],
  ['catalogo', 'Lo que vendemos', `Ramos desde 18 $ (12 rosas) hasta 65 $ (ramo grande de temporada).
Arreglos en caja desde 32 $. Plantas de interior desde 15 $.
Añadidos: chocolates 8 $, globo 5 $, tarjeta escrita a mano sin coste.`],
  ['envios', 'Envíos', `Norte de Quito: 4 $. Sur y valles: 7 $. Fuera de Quito no repartimos.
El mismo día si el pedido entra antes de las 15:00; si no, al día siguiente.
Se puede elegir franja: mañana (9–13) o tarde (14–19).`],
  ['pagos', 'Cómo se paga', `Transferencia o depósito a Banco Pichincha, cuenta corriente 2100••••••.
También aceptamos tarjeta con un enlace de pago. El pedido se confirma cuando llega el comprobante.`],
  ['faq_dedicatoria', 'Dedicatorias y anónimos', `La tarjeta va escrita a mano y no tiene coste.
Se puede enviar como anónimo: no ponemos el nombre de quien envía en ninguna parte.
Si preguntan quién envía, no lo decimos.`],
];

const PROMPTS = [
  ['perfil_agente', `Eres Lucía, la asistente de Flor y Nata, una floristería de Quito.
Hablas de usted, con calidez y sin florituras. Frases cortas.
Respondes solo con lo que sabes del negocio; lo que no sepas, lo pasas a una persona.
Nunca inventas precios, plazos ni disponibilidad.`],
  ['reglas_negocio', `- No confirmes un pedido sin que llegue el comprobante de pago.
- No prometas entrega el mismo día después de las 15:00.
- Si piden algo fuera de Quito, dilo claro: no repartimos.
- Si preguntan quién envía un ramo anónimo, no lo reveles y ofrece pasar con una persona.
- Ante un reclamo, discúlpate y pasa la conversación a una persona de inmediato.`],
  ['resumen_conversacion', `Resume en tres líneas: qué pidió el cliente, qué se le confirmó y qué falta.
Conserva importes, direcciones y fechas exactas. Omite los saludos.`],
];

/** Conversaciones de muestra. Inventadas, verosímiles y cortas. */
const CHARLAS = [
  {
    nombre: 'Marcela Andrade', wa: '593990000101', botActivo: true,
    mensajes: [
      ['ENTRANTE', 'Buenas tardes, quisiera un ramo para mañana', null],
      ['SALIENTE', 'Buenas tardes. Con gusto. ¿Para el norte de Quito o para el valle?', 'responder'],
      ['ENTRANTE', 'Norte, por la González Suárez', null],
      ['SALIENTE', 'Perfecto. Ahí el envío es de 4 $. Tenemos ramos desde 18 $ (12 rosas) hasta 65 $. ¿Prefiere mañana o tarde?', 'responder'],
      ['ENTRANTE', 'En la mañana. El de 18 está bien', null],
      ['SALIENTE', 'Anotado: ramo de 12 rosas, 18 $ más 4 $ de envío, mañana en la franja de 9 a 13.\nEl pedido se confirma cuando recibamos el comprobante. ¿Le comparto los datos de la cuenta?', 'responder'],
      ['ENTRANTE', 'Sí por favor', null],
      ['SALIENTE', 'Banco Pichincha, cuenta corriente 2100••••••, a nombre de Flor y Nata.\nEn cuanto llegue el comprobante le confirmo.', 'responder'],
    ],
  },
  {
    nombre: 'Andrés Villacís', wa: '593990000102', botActivo: false,
    motivo: 'La atiende el equipo desde WhatsApp',
    mensajes: [
      ['ENTRANTE', 'Hola, el ramo llegó con dos rosas rotas', null],
      ['SALIENTE', 'Lamento mucho lo ocurrido. Le paso ahora mismo con una persona del equipo para resolverlo.', 'escalar_a_humano'],
      ['SALIENTE', 'Buenas tardes, soy Paola. Le reponemos el ramo hoy mismo sin coste. ¿La misma dirección?', 'equipo'],
      ['ENTRANTE', 'Sí, la misma. Muchas gracias', null],
      ['SALIENTE', 'Listo, sale en la tarde. Disculpe la molestia.', 'equipo'],
    ],
  },
  {
    nombre: 'Gabriela Ponce', wa: '593990000103', botActivo: true,
    mensajes: [
      ['ENTRANTE', '¿Hacen envíos a Ambato?', null],
      ['SALIENTE', 'Buenos días. Por el momento repartimos solo en Quito y los valles; fuera de Quito no llegamos.', 'responder'],
      ['ENTRANTE', 'Ah, qué pena. Gracias', null],
    ],
  },
  {
    nombre: 'Jorge Benítez', wa: '593990000104', botActivo: true,
    mensajes: [
      ['ENTRANTE', 'Quiero enviar un arreglo pero que no aparezca mi nombre', null],
      ['SALIENTE', 'Claro que sí. Lo enviamos como anónimo: no ponemos su nombre en la tarjeta ni en ninguna parte, y si preguntan no lo decimos.\n¿Quiere que escribamos alguna dedicatoria? Va a mano y sin coste.', 'responder'],
      ['ENTRANTE', 'Sí: "Gracias por todo"', null],
      ['SALIENTE', 'Anotado. Arreglos en caja desde 32 $. ¿Para qué día lo necesita?', 'responder'],
    ],
  },
];

async function main() {
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');

    // ⚠️ El escaparate se APAGA mientras se siembra: los disparadores de la 010 impedirían
    // escribir precisamente al que tiene que poder hacerlo. Se vuelve a encender al final.
    await cli.query(`UPDATE inquilinos SET solo_lectura = false WHERE slug = $1`, [SLUG]);

    const { rows: [plan] } = await cli.query(`SELECT id FROM planes ORDER BY id LIMIT 1`);

    const { rows: [inq] } = await cli.query(
      `INSERT INTO inquilinos (slug, nombre, estado, color_acento, contacto_nombre, contacto_email)
            VALUES ($1, 'Flor y Nata', 'ACTIVO', '#BE185D', 'Demostración', NULL)
       ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre, color_acento = EXCLUDED.color_acento
         RETURNING id`, [SLUG]);

    // Pagada hasta dentro de un año: un escaparate con la mensualidad vencida enseñaría
    // la pantalla del impago en vez del producto.
    await cli.query(
      `INSERT INTO suscripciones (inquilino_id, plan_id, estado, pagado_hasta)
            VALUES ($1, $2, 'ACTIVA', (CURRENT_DATE + INTERVAL '1 year')::date)
       ON CONFLICT (inquilino_id) DO UPDATE SET pagado_hasta = EXCLUDED.pagado_hasta, estado = 'ACTIVA'`,
      [inq.id, plan.id]);

    await cli.query(
      `INSERT INTO usuarios (inquilino_id, usuario, nombre, origen, clave_hash, rol)
            VALUES ($1, 'admin', 'Administración', 'PRODUCTO', $2, 'ADMIN')
       ON CONFLICT (inquilino_id, usuario) DO UPDATE SET clave_hash = EXCLUDED.clave_hash`,
      [inq.id, await bcrypt.hash(CLAVE, 10)]);

    // Se rehace el contenido de muestra desde cero: así la demostración siempre queda
    // igual por mucho que un visitante haya trasteado.
    await cli.query(`DELETE FROM automatizaciones WHERE inquilino_id = $1`, [inq.id]);

    const { rows: [aut] } = await cli.query(
      `INSERT INTO automatizaciones (inquilino_id, nombre, tipo, descripcion, estado)
            VALUES ($1, 'Atención por WhatsApp', 'AGENTE_IA',
                    'El agente atiende pedidos, precios y envíos; escala a una persona ante un reclamo.', 'ACTIVA')
         RETURNING id`, [inq.id]);

    const { rows: [canal] } = await cli.query(
      `INSERT INTO canales (inquilino_id, automatizacion_id, numero_visible, nombre_verificado,
                            estado, bot_activo, coexistencia_verificada, razonamiento)
            VALUES ($1, $2, '+593 99 000 0100', 'Flor y Nata', 'conectado', true, true, 'low')
         RETURNING id`, [inq.id, aut.id]);

    for (const [i, [clave, titulo, contenido]] of CONOCIMIENTO.entries()) {
      await cli.query(
        `INSERT INTO conocimiento (inquilino_id, canal_id, clave, titulo, contenido, orden, activo)
              VALUES ($1,$2,$3,$4,$5,$6,true)`,
        [inq.id, canal.id, clave, titulo, contenido.trim(), i + 1]);
    }
    for (const [tipo, contenido] of PROMPTS) {
      await cli.query(
        `INSERT INTO prompts (inquilino_id, canal_id, tipo, version, contenido, activo)
              VALUES ($1,$2,$3,1,$4,true)`,
        [inq.id, canal.id, tipo, contenido.trim()]);
    }

    let hace = CHARLAS.reduce((n, c) => n + c.mensajes.length, 0) + 20;
    for (const ch of CHARLAS) {
      const { rows: [ct] } = await cli.query(
        `INSERT INTO contactos (inquilino_id, canal_id, wa_id, nombre_agenda) VALUES ($1,$2,$3,$4)
           RETURNING id`, [inq.id, canal.id, ch.wa, ch.nombre]);
      const { rows: [cv] } = await cli.query(
        `INSERT INTO conversaciones (inquilino_id, canal_id, contacto_id, bot_activo, motivo_escalado)
              VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [inq.id, canal.id, ct.id, ch.botActivo, ch.motivo ?? null]);

      for (const [dir, texto, herramienta] of ch.mensajes) {
        await cli.query(
          `INSERT INTO mensajes (inquilino_id, conversacion_id, direccion, tipo, texto, herramienta,
                                 enviado_ok, creado_en)
                VALUES ($1,$2,$3,'text',$4,$5,$6, NOW() - ($7 || ' minutes')::interval)`,
          [inq.id, cv.id, dir, texto, herramienta, dir === 'SALIENTE' ? true : null, hace--]);
      }
      await cli.query(
        `UPDATE conversaciones SET ultimo_mensaje_en =
           (SELECT MAX(creado_en) FROM mensajes WHERE conversacion_id = $1) WHERE id = $1`, [cv.id]);

      // Un gasto verosímil por conversación, para que se vea el indicador de coste.
      const corridas = ch.mensajes.filter((m) => m[0] === 'SALIENTE' && m[2] === 'responder').length;
      for (let i = 0; i < corridas; i++) {
        await cli.query(
          `INSERT INTO uso_modelo (inquilino_id, conversacion_id, modelo, tokens_entrada,
                                   tokens_salida, tokens_cache_lectura, duracion_ms)
                VALUES ($1,$2,'gpt-5.6-luna', $3, $4, $5, $6)`,
          [inq.id, cv.id, 7800 + i * 120, 90 + i * 15, i === 0 ? 0 : 7400, 1200 + i * 90]);
      }
    }

    // Y se vuelve a cerrar.
    await cli.query(`UPDATE inquilinos SET solo_lectura = true WHERE id = $1`, [inq.id]);
    await cli.query('COMMIT');

    console.log(`✔ Demostración lista en /${SLUG}`);
    console.log(`  usuario: admin · contraseña: ${CLAVE}`);
    console.log(`  ${CHARLAS.length} conversaciones, ${CONOCIMIENTO.length} bloques de conocimiento, ${PROMPTS.length} instrucciones`);
    console.log('  El inquilino queda en modo escaparate: los disparadores rechazan cualquier escritura.');
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cli.release();
  }
}

main()
  .catch((e) => { console.error('\n✖', e.message); process.exit(1); })
  .finally(() => pool.end());
