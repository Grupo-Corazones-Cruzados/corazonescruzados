#!/usr/bin/env node
/**
 * Comprueba contra la BASE REAL que los candados de la pasarela existen y muerden.
 *
 * ⚠️ TODO CORRE DENTRO DE UNA TRANSACCIÓN QUE TERMINA EN ROLLBACK, y no hay un solo
 * DELETE. El 2026-08-19 la limpieza de una prueba se llevó por delante el plan de etapas
 * de un proyecto real de Fernando; desde entonces las pruebas no borran, deshacen.
 *
 * Los ids que se usan son negativos a propósito: no colisionan con nada real ni siquiera
 * dentro de la transacción.
 *
 *   npm run pagos:prueba-bd
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config({ path: path.join(ROOT, '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c search_path=gcc_world,public',
});

let fallos = 0;
const p = (d, ok, extra = '') => {
  if (!ok) fallos++;
  console.log(`${ok ? '✔' : '✖'} ${d}${ok || !extra ? '' : `\n    ${extra}`}`);
};

const ETAPA = -9001;

async function main() {
  const c = await pool.connect();
  try {
    // ── Lo que tiene que existir tras la migración ──────────────────────────
    const { rows: tablas } = await c.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'gcc_world'
          AND table_name IN ('payment_intents','payment_events','payment_links')
        ORDER BY table_name`,
    );
    p('las tres tablas existen', tablas.length === 3, `encontradas: ${tablas.map(t => t.table_name).join(', ')}`);

    const { rows: col } = await c.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'gcc_world' AND table_name = 'invoices' AND column_name = 'payment_intent_id'`,
    );
    p('invoices sabe de qué cobro salió', col.length === 1);

    const { rows: idx } = await c.query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'gcc_world'
          AND indexname IN ('idx_payment_intents_stage_pagada','idx_payment_intents_referencia',
                            'idx_payment_events_unico','idx_payment_intents_origen_pagado')`,
    );
    p('los cuatro candados están creados', idx.length === 4, `encontrados: ${idx.map(i => i.indexname).join(', ')}`);

    // ── Y ahora lo que de verdad importa: que muerdan ───────────────────────
    await c.query('BEGIN');

    const nuevo = (estado, ref) => c.query(
      `INSERT INTO gcc_world.payment_intents
         (source_type, source_id, stage_id, channel, provider,
          net_amount, fee_amount, charge_amount, status, provider_reference)
       VALUES ('project','-1',$1,'client','simulado',2000,61.06,2061.06,$2,$3) RETURNING id`,
      [ETAPA, estado, ref],
    );

    await nuevo('paid', 'ref-A');
    p('un cobro pagado entra sin problema', true);

    let segundoPagado = false;
    try {
      await c.query('SAVEPOINT s1');
      await nuevo('paid', 'ref-B');
      segundoPagado = true;
      await c.query('RELEASE SAVEPOINT s1');
    } catch {
      await c.query('ROLLBACK TO SAVEPOINT s1');
    }
    p('🔑 la MISMA etapa no se puede pagar dos veces', !segundoPagado,
      'el índice único parcial sobre stage_id no está actuando');

    // Los abandonados no estorban: sin esto, un pago fallido dejaría la etapa bloqueada.
    let reintentoOk = true;
    try {
      await c.query('SAVEPOINT s2');
      await nuevo('failed', 'ref-C');
      await nuevo('pending', 'ref-D');
      await c.query('RELEASE SAVEPOINT s2');
    } catch (e) {
      reintentoOk = false;
      await c.query('ROLLBACK TO SAVEPOINT s2');
      console.log('    ', e.message);
    }
    p('un intento fallido o pendiente NO bloquea la etapa', reintentoOk);

    let refRepetida = false;
    try {
      await c.query('SAVEPOINT s3');
      await c.query(
        `INSERT INTO gcc_world.payment_intents
           (source_type, source_id, stage_id, channel, provider,
            net_amount, fee_amount, charge_amount, status, provider_reference)
         VALUES ('project','-1',$1,'client','simulado',10,0,10,'pending','ref-A')`,
        [ETAPA - 1],
      );
      refRepetida = true;
      await c.query('RELEASE SAVEPOINT s3');
    } catch {
      await c.query('ROLLBACK TO SAVEPOINT s3');
    }
    p('🔑 la referencia del proveedor no se repite', !refRepetida,
      'dos cobros podrían apuntar a la misma transacción de la pasarela');

    // La idempotencia del webhook: el mismo evento no entra dos veces.
    await c.query(
      `INSERT INTO gcc_world.payment_events (provider, event_id, payload) VALUES ('simulado','ev-1','{}'::jsonb)`,
    );
    const { rows: repetido } = await c.query(
      `INSERT INTO gcc_world.payment_events (provider, event_id, payload)
       VALUES ('simulado','ev-1','{}'::jsonb)
       ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`,
    );
    p('🔑 el webhook repetido no se procesa dos veces', repetido.length === 0);

    // Los importes no pueden ser negativos.
    let negativoEntro = false;
    try {
      await c.query('SAVEPOINT s4');
      await c.query(
        `INSERT INTO gcc_world.payment_intents
           (source_type, source_id, stage_id, channel, provider, net_amount, fee_amount, charge_amount)
         VALUES ('project','-1',$1,'client','simulado',-5,0,-5)`,
        [ETAPA - 2],
      );
      negativoEntro = true;
      await c.query('RELEASE SAVEPOINT s4');
    } catch {
      await c.query('ROLLBACK TO SAVEPOINT s4');
    }
    p('un importe negativo se rechaza', !negativoEntro);

    // Un canal inventado tampoco.
    let canalMalo = false;
    try {
      await c.query('SAVEPOINT s5');
      await c.query(
        `INSERT INTO gcc_world.payment_intents
           (source_type, source_id, stage_id, channel, provider, net_amount, fee_amount, charge_amount)
         VALUES ('project','-1',$1,'inventado','simulado',10,0,10)`,
        [ETAPA - 3],
      );
      canalMalo = true;
      await c.query('RELEASE SAVEPOINT s5');
    } catch {
      await c.query('ROLLBACK TO SAVEPOINT s5');
    }
    p('un canal que no existe se rechaza', !canalMalo);

    // ── `awaiting` OCUPA EL SITIO IGUAL QUE `paid` ──────────────────────────
    // Un cliente que ya subió su comprobante no puede volver a pagar lo mismo mientras
    // alguien lo revisa: si pudiera, acabaría pagando dos veces y habría que devolverle
    // dinero. (Migración 055.)
    let dobleEnEspera = false;
    try {
      await c.query('SAVEPOINT a1');
      await c.query(
        `INSERT INTO gcc_world.payment_intents
           (source_type, source_id, stage_id, channel, provider, net_amount, fee_amount, charge_amount, status)
         VALUES ('project','-1',$1,'client','simulado',10,0,10,'awaiting')`,
        [ETAPA - 5],
      );
      await c.query(
        `INSERT INTO gcc_world.payment_intents
           (source_type, source_id, stage_id, channel, provider, net_amount, fee_amount, charge_amount, status)
         VALUES ('project','-1',$1,'client','simulado',10,0,10,'awaiting')`,
        [ETAPA - 5],
      );
      dobleEnEspera = true;
      await c.query('RELEASE SAVEPOINT a1');
    } catch {
      await c.query('ROLLBACK TO SAVEPOINT a1');
    }
    p('🔑 la misma etapa no admite DOS comprobantes en espera', !dobleEnEspera);

    let esperaMasPago = false;
    try {
      await c.query('SAVEPOINT a2');
      await c.query(
        `INSERT INTO gcc_world.payment_intents
           (source_type, source_id, stage_id, channel, provider, net_amount, fee_amount, charge_amount, status)
         VALUES ('project','-1',$1,'client','simulado',10,0,10,'awaiting')`,
        [ETAPA],
      );
      esperaMasPago = true;
      await c.query('RELEASE SAVEPOINT a2');
    } catch {
      await c.query('ROLLBACK TO SAVEPOINT a2');
    }
    p('🔑 una etapa YA PAGADA tampoco admite un comprobante', !esperaMasPago,
      'se podría cobrar dos veces: una por tarjeta y otra por transferencia');

    let ticketEnEspera = false;
    try {
      await c.query('SAVEPOINT a3');
      await c.query(
        `INSERT INTO gcc_world.payment_intents
           (source_type, source_id, stage_id, channel, provider, net_amount, fee_amount, charge_amount, status)
         VALUES ('ticket','-9001',NULL,'client','simulado',10,0,10,'awaiting')`);
      await c.query(
        `INSERT INTO gcc_world.payment_intents
           (source_type, source_id, stage_id, channel, provider, net_amount, fee_amount, charge_amount, status)
         VALUES ('ticket','-9001',NULL,'client','simulado',10,0,10,'awaiting')`);
      ticketEnEspera = true;
      await c.query('RELEASE SAVEPOINT a3');
    } catch {
      await c.query('ROLLBACK TO SAVEPOINT a3');
    }
    p('🔑 y lo mismo en un origen sin etapa (ticket)', !ticketEnEspera);

    // ── TICKETS: su candado es otro, porque su stage_id es NULL ─────────────
    const nuevoTicket = (estado, ref) => c.query(
      `INSERT INTO gcc_world.payment_intents
         (source_type, source_id, stage_id, channel, provider,
          net_amount, fee_amount, charge_amount, status, provider_reference)
       VALUES ('ticket','-777',NULL,'client','simulado',50,2.95,52.95,$1,$2) RETURNING id`,
      [estado, ref],
    );

    await nuevoTicket('paid', 'tk-A');
    p('un ticket pagado entra sin problema', true);

    let segundoTicket = false;
    try {
      await c.query('SAVEPOINT t1');
      await nuevoTicket('paid', 'tk-B');
      segundoTicket = true;
      await c.query('RELEASE SAVEPOINT t1');
    } catch {
      await c.query('ROLLBACK TO SAVEPOINT t1');
    }
    p('🔑 el MISMO ticket no se puede pagar dos veces', !segundoTicket,
      'el índice idx_payment_intents_origen_pagado no está actuando (migración 054)');

    let otroTicket = true;
    try {
      await c.query('SAVEPOINT t2');
      await c.query(
        `INSERT INTO gcc_world.payment_intents
           (source_type, source_id, stage_id, channel, provider, net_amount, fee_amount, charge_amount, status)
         VALUES ('ticket','-778',NULL,'client','simulado',10,0.5,10.5,'paid')`);
      await c.query('RELEASE SAVEPOINT t2');
    } catch (e) {
      otroTicket = false;
      await c.query('ROLLBACK TO SAVEPOINT t2');
      console.log('    ', e.message);
    }
    p('pero OTRO ticket sí puede pagarse', otroTicket);

    // Y el candado de tickets no debe estorbar a los proyectos, que van por stage_id.
    let proyectoSinEtapa = true;
    try {
      await c.query('SAVEPOINT t3');
      await c.query(
        `INSERT INTO gcc_world.payment_intents
           (source_type, source_id, stage_id, channel, provider, net_amount, fee_amount, charge_amount, status)
         VALUES ('project','-779',NULL,'client','simulado',10,0.5,10.5,'paid')`);
      await c.query('RELEASE SAVEPOINT t3');
    } catch {
      proyectoSinEtapa = false;
      await c.query('ROLLBACK TO SAVEPOINT t3');
    }
    p('los dos candados conviven sin pisarse', proyectoSinEtapa);

    await c.query('ROLLBACK');

    // ── Y que el rollback de verdad no dejó nada ────────────────────────────
    const { rows: quedan } = await c.query(
      `SELECT COUNT(*)::int AS n FROM gcc_world.payment_intents
        WHERE stage_id <= $1 OR source_id IN ('-777','-778','-779','-9001')`, [ETAPA],
    );
    p('la prueba no dejó una sola fila detrás', quedan[0].n === 0, `quedaron ${quedan[0].n}`);
  } finally {
    c.release();
    await pool.end();
  }

  console.log(fallos ? `\n❌ ${fallos} fallos` : '\n✅ todas pasan');
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
