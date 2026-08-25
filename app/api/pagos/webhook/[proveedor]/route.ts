/**
 * EL WEBHOOK — la única fuente de verdad de que un pago ocurrió.
 *
 * Todo lo que hace este endpoint está pensado alrededor de un hecho: **Kushki reintenta
 * hasta 7 veces en 3 horas** mientras no reciba un 200. Es decir, el mismo evento va a
 * llegar varias veces, y cada llegada podría emitir un comprobante si no se le impide.
 * Hay dos barreras, y ninguna sobra:
 *   1. `registrarEvento` — `UNIQUE (provider, event_id)`: el evento repetido ni se mira.
 *   2. `confirmarPago`   — `UPDATE ... WHERE status <> 'paid'`: aunque el evento fuera
 *      distinto, el cobro solo se confirma una vez.
 *
 * ⚠️ Y una regla de respuesta que cuesta acertar: **se responde 200 a casi todo**. Un 500
 * por un evento que no entendemos hace que la pasarela lo reintente siete veces y luego
 * lo dé por perdido, sin que nadie se entere. El único caso que NO es 200 es la firma
 * inválida — ahí sí queremos que se note.
 */
import { NextRequest, NextResponse } from 'next/server';
import { proveedorPorNombre } from '@/lib/pagos';
import {
  registrarEvento, marcarEventoAtendido, buscarIntento, confirmarPago, marcarFallido,
} from '@/lib/pagos/intentos';

export async function POST(req: NextRequest, { params }: { params: Promise<{ proveedor: string }> }) {
  const { proveedor: nombre } = await params;

  let proveedor;
  try {
    proveedor = proveedorPorNombre(nombre);
  } catch {
    return NextResponse.json({ error: 'Proveedor desconocido' }, { status: 404 });
  }

  // ⚠️ El cuerpo CRUDO, no el JSON parseado: la firma se calcula sobre los bytes exactos
  // que llegaron, y `JSON.parse` + `JSON.stringify` reordena claves y cambia espacios.
  const crudo = await req.text();

  if (!proveedor.verificarWebhook(crudo, req.headers)) {
    console.warn(`[pagos] webhook de ${nombre} con firma inválida`);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  let payload: any = null;
  try { payload = crudo ? JSON.parse(crudo) : null; } catch { /* no era JSON */ }

  const evento = proveedor.interpretarWebhook(payload);
  if (!evento) {
    // No es un evento de cobro (o no lo sabemos leer). Se responde 200 para que la
    // pasarela no lo reintente eternamente, pero queda el aviso en el registro.
    console.warn(`[pagos] webhook de ${nombre} no interpretable:`, crudo.slice(0, 300));
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const intento = await buscarIntento(nombre, evento.intentId, evento.referencia);

  const esNuevo = await registrarEvento(nombre, evento.eventId, intento?.id ?? null, payload);
  if (!esNuevo) {
    // Reintento del mismo evento: ya se atendió. Este es el camino normal, no un error.
    return NextResponse.json({ ok: true, repetido: true });
  }

  if (!intento) {
    console.warn(`[pagos] webhook de ${nombre} sin cobro asociado (ref ${evento.referencia})`);
    await marcarEventoAtendido(nombre, evento.eventId, 'sin cobro asociado');
    return NextResponse.json({ ok: true, huerfano: true });
  }

  try {
    if (evento.estado === 'paid') {
      const r = await confirmarPago(intento.id, {
        referencia: evento.referencia,
        metodo: evento.metodo,
        estadoProveedor: evento.detalle,
      });
      await marcarEventoAtendido(
        nombre, evento.eventId,
        r.yaEstaba ? 'ya estaba pagado' : `factura ${r.invoiceId ?? 'pendiente'}${r.error ? ` · ${r.error}` : ''}`,
      );
    } else if (evento.estado === 'failed') {
      await marcarFallido(intento.id, evento.detalle || 'Rechazado por la pasarela.');
      await marcarEventoAtendido(nombre, evento.eventId, 'rechazado');
    } else {
      await marcarEventoAtendido(nombre, evento.eventId, 'pendiente');
    }
  } catch (err: any) {
    // Se deja constancia y se responde 200 igualmente: el evento ya está guardado entero,
    // así que se puede reprocesar a mano sin depender de que la pasarela reintente.
    console.error(`[pagos] error atendiendo webhook ${evento.eventId}:`, err.message);
    await marcarEventoAtendido(nombre, evento.eventId, `error: ${err.message}`);
  }

  return NextResponse.json({ ok: true });
}
