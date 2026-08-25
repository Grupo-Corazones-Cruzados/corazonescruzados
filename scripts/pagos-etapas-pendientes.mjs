#!/usr/bin/env node
/**
 * SOLO LECTURA: qué se cobraría hoy por cada etapa pendiente de los proyectos reales.
 *
 * No escribe ni una fila. Sirve para ver el cálculo del recargo aplicado a los importes
 * de verdad —no a ejemplos— antes de que nadie pague nada, y para comprobar que no hay
 * etapas con importe cero o descuadradas contra el costo del proyecto.
 *
 *   npm run pagos:pendientes
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config({ path: path.join(ROOT, '.env') });

// Misma tarifa que `lib/pagos/comision.ts`. Se repite aquí a propósito: este script es una
// COMPROBACIÓN INDEPENDIENTE, y si importara el módulo que quiere verificar no comprobaría
// nada — coincidirían por construcción.
const PCT = 0.0295, FIJO = 0.25;
const arriba = (n) => Math.ceil(Math.round(n * 1e6) / 1e4) / 100;
const dosDec = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n) => `$${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c search_path=gcc_world,public',
});

const { rows } = await pool.query(`
  SELECT p.id AS proyecto_id, p.title, p.final_cost, p.status,
         e.id AS etapa_id, e.name, e.amount, e.sort_order,
         (e.invoice_id IS NOT NULL) AS facturada,
         (SELECT COUNT(*)::int FROM gcc_world.payment_intents pi
           WHERE pi.stage_id = e.id AND pi.status = 'paid') AS cobros_pagados
    FROM gcc_world.project_stages e
    JOIN gcc_world.projects p ON p.id = e.project_id
   WHERE p.status NOT IN ('cancelled','cotizacion','cotizacion_rechazada')
   ORDER BY p.id, e.sort_order, e.id
`);

if (rows.length === 0) {
  console.log('No hay ningún proyecto con plan de etapas todavía.');
  console.log('El cobro en línea de la v1 solo cubre proyectos CON plan: sin plan, no hay qué cobrar.');
  await pool.end();
  process.exit(0);
}

const porProyecto = new Map();
for (const r of rows) {
  if (!porProyecto.has(r.proyecto_id)) porProyecto.set(r.proyecto_id, { info: r, etapas: [] });
  porProyecto.get(r.proyecto_id).etapas.push(r);
}

let avisos = 0;
let totalPendiente = 0, totalRecargo = 0;

for (const [pid, { info, etapas }] of porProyecto) {
  const suma = dosDec(etapas.reduce((s, e) => s + Number(e.amount), 0));
  const costo = dosDec(Number(info.final_cost) || 0);
  console.log(`\n── #${pid} · ${info.title}  (${info.status})`);
  console.log(`   costo del proyecto ${money(costo)} · plan ${money(suma)}${
    costo > 0 && Math.abs(costo - suma) > 0.01 ? `   ⚠️ el plan NO cuadra con el costo` : ''}`);
  if (costo > 0 && Math.abs(costo - suma) > 0.01) avisos++;

  for (const e of etapas) {
    const neto = dosDec(Number(e.amount));
    const estado = e.facturada ? 'facturada' : e.cobros_pagados > 0 ? 'PAGADA sin factura ⚠️' : 'pendiente';
    if (e.cobros_pagados > 0 && !e.facturada) avisos++;

    if (e.facturada || e.cobros_pagados > 0) {
      console.log(`   · ${e.name.padEnd(28).slice(0, 28)} ${money(neto).padStart(12)}   ${estado}`);
      continue;
    }
    if (!(neto > 0)) {
      console.log(`   · ${e.name.padEnd(28).slice(0, 28)} ${money(neto).padStart(12)}   ⚠️ SIN IMPORTE: no se puede cobrar`);
      avisos++;
      continue;
    }
    const total = arriba((neto + FIJO) / (1 - PCT));
    const recargo = dosDec(total - neto);
    totalPendiente += neto; totalRecargo += recargo;
    console.log(`   · ${e.name.padEnd(28).slice(0, 28)} ${money(neto).padStart(12)}   + ${money(recargo)} de recargo  →  el cliente paga ${money(total)}`);
  }
}

console.log(`\n${'─'.repeat(72)}`);
console.log(`Pendiente de cobro: ${money(dosDec(totalPendiente))} · recargo que asumiría el cliente: ${money(dosDec(totalRecargo))}`);
console.log(avisos ? `⚠️  ${avisos} aviso(s) que conviene mirar antes de cobrar.` : '✅ Sin avisos.');

await pool.end();
