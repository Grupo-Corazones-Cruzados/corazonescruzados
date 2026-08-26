/**
 * CONFIRMAR (o rechazar) UNA TRANSFERENCIA.
 *
 * «la confirmación solo la puede hacer el usuario que recibirá el pago desde la página de
 * detalle de lo que se esté ofreciendo» (Fernando, 2026-08-26). Ese «usuario que recibirá el
 * pago» ya está definido en el sistema: es quien puede compartir el enlace de cobro de ese
 * origen —el responsable del proyecto, el miembro del ticket, el admin en suscripciones y
 * productos—, así que se reusa esa misma puerta en vez de inventar un permiso nuevo.
 *
 * Al confirmar se emite la factura. Es el momento en que GCC dice «este dinero está en mi
 * banco», y por eso queda escrito **quién** lo dijo.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { autorizarCompartir, SinAcceso } from '@/lib/pagos/acceso';
import {
  confirmarTransferencia, rechazarTransferencia,
  partesMesSuscripcion, partesAltaProducto,
} from '@/lib/pagos/intentos';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cuerpo = await req.json().catch(() => ({}));
    const accion = cuerpo.accion === 'rechazar' ? 'rechazar' : 'confirmar';

    const { rows: [i] } = await pool.query(
      `SELECT source_type, source_id, status, charge_amount FROM gcc_world.payment_intents WHERE id = $1`,
      [id],
    );
    if (!i) return NextResponse.json({ error: 'Cobro no encontrado' }, { status: 404 });
    if (i.status !== 'awaiting') {
      return NextResponse.json({ error: 'Este cobro no está esperando confirmación.' }, { status: 409 });
    }

    const propio = i.source_type === 'subscription' ? partesMesSuscripcion(i.source_id).subId
      : i.source_type === 'product' ? partesAltaProducto(i.source_id).itemId
      : i.source_id;
    await autorizarCompartir(propio, i.source_type);

    const user = await getCurrentUser();
    const quien = String(user?.email || 'desconocido');

    if (accion === 'rechazar') {
      const motivo = String(cuerpo.motivo || '').trim();
      if (motivo.length < 4) {
        return NextResponse.json({ error: 'Escribe por qué se rechaza: el cliente tiene que saberlo.' }, { status: 400 });
      }
      await rechazarTransferencia(Number(id), quien, motivo);
      return NextResponse.json({ ok: true, estado: 'failed' });
    }

    const r = await confirmarTransferencia(Number(id), quien);
    return NextResponse.json({
      ok: true,
      estado: 'paid',
      invoiceId: r.invoiceId,
      facturaAutorizada: r.autorizada,
      // Si el cobro se dio por bueno pero la factura falló, quien confirma tiene que
      // enterarse AHORA: el dinero ya está dado por recibido.
      aviso: r.error ? `El pago quedó confirmado, pero la factura falló: ${r.error}` : null,
    });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[pagos] confirmar:', err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
