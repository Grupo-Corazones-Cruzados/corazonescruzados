import { NextResponse } from 'next/server';
import { purgarRetencionAgente } from '@/lib/agente/retencion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * LA RETENCIÓN, DISPARADA DESDE FUERA.
 *
 * ── POR QUÉ HIZO FALTA (2026-09-26) ──────────────────────────────────────────────
 * `lib/agente/retencion.ts` se trajo en la mudanza del 23 de septiembre, pero **nadie lo
 * llamaba**: no tenía endpoint ni cron. La purga la seguía haciendo la plataforma sobre
 * SUS tablas viejas, así que al retirar ese código el borrado se habría quedado sin
 * ejecutar en ninguna parte.
 *
 * Y no es un detalle de limpieza: `/legal/whatsapp` (A.8) **promete** que la traza cruda
 * de Meta se borra a los 30 días. Una política publicada sin el borrado que la cumple es
 * una declaración falsa. La regla de la casa: primero el código, después la promesa.
 *
 * Desde el corte, el producto llevaba tres días acumulando esa traza sin purgarla.
 *
 * ── CÓMO SE DISPARA ─────────────────────────────────────────────────────────────
 * Lo llama `scripts/frequent-cron.mjs` de la plataforma, igual que a los otros productos,
 * con el `CRON_TOKEN` de este servicio. Es **idempetente**: repetirlo el mismo día no
 * borra nada nuevo, así que da igual cuántas veces se dispare.
 *
 * ⚠️ Purga la traza y la cola cerrada; NO toca las conversaciones. Esas son el historial
 * de atención de la empresa cliente, que es quien decide su plazo.
 */
export async function POST(peticion: Request) {
  // Las dos formas, como en los demás productos: `x-cron-token` la usa el cron y
  // `Authorization: Bearer` es la cómoda para probar a mano.
  const token = process.env.CRON_TOKEN;
  const cabecera = peticion.headers.get('authorization') || '';
  const suelto = peticion.headers.get('x-cron-token') || '';
  if (!token || (cabecera !== `Bearer ${token}` && suelto !== token))
    return NextResponse.json({ error: 'Sin autorización' }, { status: 401 });

  try {
    const r = await purgarRetencionAgente();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    // Se devuelve el fallo con 500 a propósito: el cron cuenta los errores y un borrado
    // que no ocurre tiene que verse, no perderse en un 200 optimista.
    console.error('[retención] no se pudo purgar:', e);
    return NextResponse.json({ error: 'No se pudo purgar.' }, { status: 500 });
  }
}
