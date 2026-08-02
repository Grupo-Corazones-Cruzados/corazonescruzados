/**
 * Un PASE del worker: recupera colgados, reclama trabajos y hace correr el agente.
 *
 * Next en Railway solo atiende peticiones: no ejecuta nada por su cuenta. El disparo lo
 * hace un servicio aparte (`scripts/agente-worker.mjs`) que llama aquí cada pocos
 * segundos con el secreto compartido — el mismo esquema que el cron de la casa.
 *
 * Se reutiliza `CRON_TOKEN` en vez de introducir un `WORKER_SECRET` propio: es el mismo
 * mecanismo, ya está desplegado en los dos servicios, y un secreto menos es un secreto
 * menos que rotar y que olvidar.
 *
 * Fail-closed: sin `CRON_TOKEN` en el servidor, 503. Es preferible que el worker no corra
 * a que corra abierto a cualquiera.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { reclamar, recuperarColgados, resumenCola } from '@/lib/agente/cola';
import { procesarTrabajo } from '@/lib/agente/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Un pase no debería tardar tanto, pero conversar con el modelo puede irse a varios segundos. */
export const maxDuration = 120;

/** Cuántas conversaciones se atienden por pase. Bajo a propósito: ver la nota de abajo. */
const POR_PASE = 5;

export async function POST(req: NextRequest) {
  if (!cronTokenConfigured()) {
    return NextResponse.json({ error: 'Falta CRON_TOKEN en el servidor' }, { status: 503 });
  }
  if (!checkCronToken(req)) {
    return NextResponse.json({ error: 'Token de worker inválido' }, { status: 401 });
  }

  const arranque = Date.now();

  // Primero los colgados: un despliegue a media corrida deja trabajos en 'procesando' que
  // nadie va a terminar, y el índice único impide encolar otro para esa conversación.
  let recuperados = 0;
  try { recuperados = await recuperarColgados(); }
  catch (e: any) { console.error('[agente/procesar] recuperando colgados:', e?.message); }

  let trabajos: Awaited<ReturnType<typeof reclamar>> = [];
  try { trabajos = await reclamar(POR_PASE); }
  catch (e: any) {
    console.error('[agente/procesar] reclamando:', e?.message);
    return NextResponse.json({ error: 'No se pudo reclamar de la cola' }, { status: 500 });
  }

  // En serie a propósito. Cada corrida es una llamada al modelo del cliente, y varias a la
  // vez con la misma clave se comen su límite de uso de golpe. Con un pase cada pocos
  // segundos, cinco por pase sobra para un ritmo de conversación humano.
  const resultados = [];
  for (const t of trabajos) {
    try {
      resultados.push(await procesarTrabajo(t));
    } catch (e: any) {
      // procesarTrabajo ya captura lo suyo; esto es el último cinturón para que una
      // conversación rota no se lleve por delante el pase entero.
      console.error('[agente/procesar] trabajo', t.id, e?.message);
      resultados.push({ conversacionId: t.conversacion_id, accion: 'error' as const, detalle: e?.message });
    }
  }

  const cuenta = resultados.reduce<Record<string, number>>((acc, r) => {
    acc[r.accion] = (acc[r.accion] ?? 0) + 1; return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    recuperados,
    reclamados: trabajos.length,
    cuenta,
    ms: Date.now() - arranque,
    // Para que el worker sepa si merece la pena volver enseguida en vez de esperar.
    quedan: trabajos.length >= POR_PASE,
  });
}

/** Estado de la cola, para mirar sin disparar nada. */
export async function GET(req: NextRequest) {
  if (!cronTokenConfigured()) return NextResponse.json({ error: 'Falta CRON_TOKEN' }, { status: 503 });
  if (!checkCronToken(req)) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  return NextResponse.json({ cola: await resumenCola() });
}
