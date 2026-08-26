/**
 * SERVIR EL COMPROBANTE que subió el cliente, para que quien confirma pueda mirarlo.
 *
 * Solo para quien puede confirmar ese cobro: es un documento bancario de una persona, no un
 * adjunto cualquiera. Se comprueba con `autorizarCompartir`, que es la misma puerta que
 * decide quién puede cobrar por ese origen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { autorizarCompartir, SinAcceso } from '@/lib/pagos/acceso';
import { partesMesSuscripcion, partesAltaProducto } from '@/lib/pagos/intentos';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows: [i] } = await pool.query(
      `SELECT source_type, source_id, proof_data, proof_type, proof_name
         FROM gcc_world.payment_intents WHERE id = $1`,
      [id],
    );
    if (!i) return NextResponse.json({ error: 'Cobro no encontrado' }, { status: 404 });
    if (!i.proof_data) return NextResponse.json({ error: 'Este cobro no tiene comprobante' }, { status: 404 });

    // El origen del cobro decide quién manda: el responsable del proyecto o del ticket, y el
    // admin en suscripciones y productos.
    const propio = i.source_type === 'subscription' ? partesMesSuscripcion(i.source_id).subId
      : i.source_type === 'product' ? partesAltaProducto(i.source_id).itemId
      : i.source_id;
    await autorizarCompartir(propio, i.source_type);

    const bytes = Buffer.isBuffer(i.proof_data) ? i.proof_data : Buffer.from(i.proof_data);
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': i.proof_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${(i.proof_name || 'comprobante').replace(/"/g, '')}"`,
      },
    });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
