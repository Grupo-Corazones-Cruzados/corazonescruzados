import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { correrTurno } from '@/lib/presupuestos/agente';
import { cargarCuenta } from '@/lib/presupuestos/cuenta';
import { MAX_TOKENS_SESION, sesionDeEsteEquipo } from '@/lib/presupuestos/db';

/** Un mensaje de la conversación. Responde en NDJSON, un evento por línea, a medida que el agente trabaja. */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const MAX_TEXTO = 4000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await sesionDeEsteEquipo(id);
  if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
  if (sesion.enviada_tipo) return NextResponse.json({ error: 'Este presupuesto ya se envió.' }, { status: 409 });
  if (Number(sesion.tokens) >= MAX_TOKENS_SESION) {
    return NextResponse.json({ error: 'Esta sesión llegó a su límite de uso.', agotada: true }, { status: 429 });
  }
  const { texto } = await req.json().catch(() => ({}));
  const limpio = String(texto ?? '').trim().slice(0, MAX_TEXTO);
  if (!limpio) return NextResponse.json({ error: 'Escribe tu mensaje.' }, { status: 400 });

  // Un turno a la vez: dos a la vez se pisarían la conversación y duplicarían el consumo.
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.presupuesto_sesiones SET ocupada_hasta = NOW() + INTERVAL '3 minutes'
      WHERE id = $1 AND (ocupada_hasta IS NULL OR ocupada_hasta < NOW())`,
    [id],
  );
  if (!rowCount) return NextResponse.json({ error: 'El agente todavía está respondiendo.' }, { status: 409 });

  const usuario = await getCurrentUser();
  const cuenta = usuario ? await cargarCuenta(usuario) : null;

  const cuerpo = new ReadableStream({
    async start(control) {
      const codificar = new TextEncoder();
      const emitir = (e: unknown) => { try { control.enqueue(codificar.encode(`${JSON.stringify(e)}\n`)); } catch { /* el navegador se fue; el turno sigue y se guarda */ } };
      try {
        await correrTurno(sesion, limpio, emitir, cuenta);
      } catch (e) {
        console.error('[presupuestos] turno', (e as Error).message);
        emitir({ tipo: 'error', texto: 'El agente no pudo responder. Inténtalo otra vez.' });
      } finally {
        await pool.query(`UPDATE gcc_world.presupuesto_sesiones SET ocupada_hasta = NULL WHERE id = $1`, [id]).catch(() => {});
        emitir({ tipo: 'fin' });
        try { control.close(); } catch { /* ya cerrado */ }
      }
    },
  });
  return new Response(cuerpo, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
