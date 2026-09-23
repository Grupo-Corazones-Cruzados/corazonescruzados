#!/usr/bin/env node
/**
 * CONCILIAR lo que quedó en la plataforma DESPUÉS del cambio de webhook.
 *
 *   node scripts/conciliar-con-la-plataforma.mjs --contar   → solo mira
 *   node scripts/conciliar-con-la-plataforma.mjs            → concilia
 *
 * ── POR QUÉ ESTE SCRIPT EXISTE Y NO VALE EL DE LA MUDANZA ────────────────────────
 * `traer-de-la-plataforma.mjs` copia CONSERVANDO LOS IDENTIFICADORES, y eso fue lo
 * correcto mientras solo escribía un sistema: hacía la copia repetible y rastreable.
 *
 * En cuanto Meta pasó a apuntar al producto, dejó de valer. Ahora **los dos sistemas han
 * asignado identificadores de los mismos rangos**, así que un id ya no identifica una fila:
 * el mensaje 30847 de la plataforma y el 30847 del producto pueden ser mensajes distintos.
 * Repetir la mudanza con `ON CONFLICT (id) DO NOTHING` **se saltaría el de la plataforma
 * en silencio**, que es la peor forma posible de perder un mensaje de un cliente.
 * (Comprobado: había exactamente una colisión de esas cuando se detectó.)
 *
 * Así que aquí se casa por CLAVE NATURAL —lo que de verdad identifica a cada fila— y los
 * identificadores se dejan a la secuencia:
 *
 *   · contacto      → (canal_id, wa_id)
 *   · conversación  → (canal_id, contacto)
 *   · mensaje       → wa_message_id … y cuando es nulo (las respuestas del agente, que no
 *                     tienen id de WhatsApp) por (conversación, dirección, instante, texto).
 *
 * Es idempotente: correrlo dos veces no duplica nada.
 *
 * ⚠️ NO BORRA NADA DE `gcc_world`. Lo de allí se queda como estaba; esto solo añade lo que
 * falta aquí. Si algo sale mal, la fuente sigue intacta.
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

const cuentas = [];
const anota = (paso, n) => { cuentas.push([paso, n]); return n; };

async function main() {
  const cli = await pool.connect();
  try {
    // ── Los canales son los mismos a los dos lados (la mudanza conservó sus ids, y hay
    //    que conservarlos: el cifrado de los tokens depende de ellos).
    const { rows: canales } = await cli.query(`SELECT id, inquilino_id FROM canales`);
    const inqDeCanal = new Map(canales.map((c) => [c.id, c.inquilino_id]));
    const canalesValidos = new Set(canales.map((c) => c.id));

    // ── 1. CONTACTOS, por (canal_id, wa_id)
    const { rows: contactosV } = await cli.query(
      `SELECT id, canal_id, wa_id, nombre_perfil, nombre_agenda, created_at, updated_at
         FROM gcc_world.agente_contactos ORDER BY id`);
    const { rows: contactosN } = await cli.query(`SELECT id, canal_id, wa_id FROM contactos`);
    const mapaContacto = new Map();                       // id plataforma → id producto
    const clave = (c, w) => `${c}|${w}`;
    const porClave = new Map(contactosN.map((c) => [clave(c.canal_id, c.wa_id), c.id]));

    const contactosQueFaltan = [];
    for (const c of contactosV) {
      if (!canalesValidos.has(c.canal_id)) continue;
      const ya = porClave.get(clave(c.canal_id, c.wa_id));
      if (ya) mapaContacto.set(c.id, ya);
      else contactosQueFaltan.push(c);
    }

    // ── 2. CONVERSACIONES, por (canal_id, contacto)
    const { rows: convsV } = await cli.query(
      `SELECT id, canal_id, contacto_id, bot_activo, motivo_escalado, resumen, resumen_hasta_id,
              ultimo_mensaje_en, created_at, updated_at
         FROM gcc_world.agente_conversaciones ORDER BY id`);
    const { rows: convsN } = await cli.query(`SELECT id, canal_id, contacto_id FROM conversaciones`);
    const convPorClave = new Map(convsN.map((c) => [clave(c.canal_id, c.contacto_id), c.id]));
    const mapaConv = new Map();

    // ── 3. MENSAJES que faltan
    const { rows: mensajesV } = await cli.query(
      `SELECT * FROM gcc_world.agente_mensajes ORDER BY id`);
    const { rows: wamids } = await cli.query(
      `SELECT wa_message_id FROM mensajes WHERE wa_message_id IS NOT NULL`);
    const yaTengo = new Set(wamids.map((r) => r.wa_message_id));
    // Para los que no tienen id de WhatsApp: su huella es conversación + instante + texto.
    const { rows: huellas } = await cli.query(
      `SELECT conversacion_id, direccion, creado_en, coalesce(texto,'') texto
         FROM mensajes WHERE wa_message_id IS NULL`);
    const huella = (conv, dir, creado, texto) =>
      `${conv}|${dir}|${new Date(creado).toISOString()}|${(texto || '').slice(0, 80)}`;
    const yaSinWamid = new Set(huellas.map((r) =>
      huella(r.conversacion_id, r.direccion, r.creado_en, r.texto)));

    if (soloContar) {
      const convsQueFaltan = convsV.filter((c) => {
        if (!canalesValidos.has(c.canal_id)) return false;
        const ct = mapaContacto.get(c.contacto_id);
        return !(ct && convPorClave.has(clave(c.canal_id, ct)));
      }).length;
      const conWamid = mensajesV.filter((m) => m.wa_message_id && !yaTengo.has(m.wa_message_id)).length;
      const sinWamid = mensajesV.filter((m) => !m.wa_message_id).length;
      console.log(`  contactos que faltan:      ${contactosQueFaltan.length}`);
      console.log(`  conversaciones que faltan: ~${convsQueFaltan} (o más, si su contacto tampoco está)`);
      console.log(`  mensajes con id de WA:     ${conWamid}`);
      console.log(`  mensajes sin id de WA:     hasta ${sinWamid} (se filtran por huella al conciliar)`);
      return;
    }

    await cli.query('BEGIN');

    // ── Insertar contactos que faltan. El id lo pone la SECUENCIA, no la plataforma.
    let nC = 0;
    for (const c of contactosQueFaltan) {
      const { rows: [f] } = await cli.query(
        `INSERT INTO contactos (inquilino_id, canal_id, wa_id, nombre_perfil, nombre_agenda, creado_en, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())
         ON CONFLICT (canal_id, wa_id) DO UPDATE SET actualizado_en = NOW()
         RETURNING id`,
        [inqDeCanal.get(c.canal_id), c.canal_id, c.wa_id, c.nombre_perfil, c.nombre_agenda, c.created_at]);
      mapaContacto.set(c.id, f.id);
      nC++;
    }
    anota('contactos añadidos', nC);

    // ── Conversaciones
    let nV = 0;
    for (const c of convsV) {
      if (!canalesValidos.has(c.canal_id)) continue;
      const ct = mapaContacto.get(c.contacto_id);
      if (!ct) continue;                                   // su contacto no es de un canal nuestro
      const ya = convPorClave.get(clave(c.canal_id, ct));
      if (ya) { mapaConv.set(c.id, ya); continue; }
      const { rows: [f] } = await cli.query(
        `INSERT INTO conversaciones
           (inquilino_id, canal_id, contacto_id, bot_activo, motivo_escalado, resumen,
            resumen_hasta_id, ultimo_mensaje_en, creado_en, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
         ON CONFLICT (canal_id, contacto_id) DO UPDATE SET actualizado_en = NOW()
         RETURNING id`,
        [inqDeCanal.get(c.canal_id), c.canal_id, ct, c.bot_activo, c.motivo_escalado, c.resumen,
         c.resumen_hasta_id, c.ultimo_mensaje_en, c.created_at]);
      mapaConv.set(c.id, f.id);
      convPorClave.set(clave(c.canal_id, ct), f.id);
      nV++;
    }
    anota('conversaciones añadidas', nV);

    // ── Mensajes
    const DIR = { entrante: 'ENTRANTE', saliente: 'SALIENTE' };
    let nM = 0, saltados = 0;
    for (const m of mensajesV) {
      const conv = mapaConv.get(m.conversacion_id);
      if (!conv) { saltados++; continue; }

      if (m.wa_message_id) {
        if (yaTengo.has(m.wa_message_id)) continue;
      } else {
        const h = huella(conv, DIR[m.direccion] ?? 'ENTRANTE', m.created_at, m.texto);
        if (yaSinWamid.has(h)) continue;
        yaSinWamid.add(h);
      }

      await cli.query(
        `INSERT INTO mensajes
           (inquilino_id, conversacion_id, direccion, wa_message_id, tipo, texto, payload,
            ubicacion_lat, ubicacion_lng, ubicacion_texto, ubicacion_resuelta_en,
            medio_resuelto_en, herramienta, motivo, enviado_ok, error_envio, creado_en)
         SELECT cv.inquilino_id, cv.id, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
           FROM conversaciones cv WHERE cv.id = $1
         ON CONFLICT (wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING`,
        [conv, DIR[m.direccion] ?? 'ENTRANTE', m.wa_message_id, m.tipo, m.texto,
         JSON.stringify(m.payload ?? null), m.ubicacion_lat, m.ubicacion_lng, m.ubicacion_texto,
         m.ubicacion_resuelta_en, m.medio_resuelto_en, m.herramienta, m.motivo,
         m.enviado_ok, m.error_envio, m.created_at]);
      if (m.wa_message_id) yaTengo.add(m.wa_message_id);
      nM++;
    }
    anota('mensajes añadidos', nM);
    anota('mensajes saltados (sin conversación nuestra)', saltados);

    // ── La fecha del último mensaje de cada conversación, recalculada: si no, la bandeja
    //    ordena por un valor viejo y lo recién traído se hunde.
    const { rowCount: tocadas } = await cli.query(
      `UPDATE conversaciones c
          SET ultimo_mensaje_en = m.ultimo, actualizado_en = NOW()
         FROM (SELECT conversacion_id, MAX(creado_en) ultimo FROM mensajes GROUP BY 1) m
        WHERE m.conversacion_id = c.id
          AND (c.ultimo_mensaje_en IS DISTINCT FROM m.ultimo)`);
    anota('conversaciones reordenadas', tocadas ?? 0);

    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cli.release();
  }

  for (const [paso, n] of cuentas) console.log(`  ${String(n).padStart(6)}  ${paso}`);
  console.log('\n✔ Conciliado. En `gcc_world` no se ha borrado ni modificado nada.');
}

main()
  .catch((e) => { console.error('\n✖', e.message); process.exit(1); })
  .finally(() => pool.end());
