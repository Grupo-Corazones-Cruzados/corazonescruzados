/**
 * LA URL DE RESPUESTA DE PAYPHONE — la llamada de los 5 minutos.
 *
 * PayPhone trae aquí al cliente después de pagar, con `?id=…&clientTransactionId=…`.
 * **Este endpoint es el que cierra el cobro**: si no confirma contra su API dentro de los
 * primeros 5 minutos, PayPhone reversa la transacción sola. Por eso confirma en el acto y
 * no encola nada.
 *
 * ⚠️ ES UN GET CON EFECTOS, y no por descuido: lo impone la redirección del navegador. Lo
 * que lo hace seguro es que `confirmarPago` es idempotente — si el cliente recarga la
 * página o le da al botón de atrás, el segundo paso no emite un segundo comprobante.
 *
 * Registrada en el portal de PayPhone como `https://app.grupocc.org/pagos/respuesta`; solo
 * el dominio declarado puede invocar la Cajita, así que esta ruta no puede cambiar de sitio
 * sin tocar también la ficha de la aplicación.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { confirmarTransaccion } from '@/lib/pagos/payphone';
import { confirmarPago, marcarFallido, registrarEvento, marcarEventoAtendido } from '@/lib/pagos/intentos';

const centavos = (n: number) => Math.round(n * 100);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const idBruto = sp.get('id');
  const clientTxId = sp.get('clientTransactionId') || '';
  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const aResultado = (estado: string, intentId?: number | null) =>
    NextResponse.redirect(`${base}/pagos/resultado?estado=${estado}${intentId ? `&i=${intentId}` : ''}`);

  if (!idBruto || !/^\d+$/.test(idBruto) || !/^\d+$/.test(clientTxId)) {
    console.error('[pagos] respuesta de PayPhone sin parámetros válidos:', req.nextUrl.search);
    return aResultado('invalido');
  }

  const transaccionId = Number(idBruto);
  const intentId = Number(clientTxId);

  try {
    // El evento se registra ANTES de confirmar. Si el cliente recarga, el segundo pase ve
    // que ya se atendió; y si algo revienta a mitad, queda el rastro de que PayPhone llegó.
    const primeraVez = await registrarEvento('payphone', `resp:${transaccionId}`, intentId, {
      id: transaccionId, clientTransactionId: clientTxId,
    });

    const { rows: [intento] } = await pool.query(
      `SELECT id, charge_amount, status, invoice_id FROM gcc_world.payment_intents WHERE id = $1`,
      [intentId],
    );
    if (!intento) {
      console.error(`[pagos] PayPhone confirmó el cobro ${transaccionId} de un intento inexistente (${intentId})`);
      return aResultado('desconocido');
    }

    // Ya estaba resuelto: recarga del navegador o vuelta atrás. No se vuelve a confirmar.
    if (intento.status === 'paid') return aResultado('pagado', intentId);

    const conf = await confirmarTransaccion(transaccionId, clientTxId);

    if (!conf.aprobada) {
      await marcarFallido(intentId, `PayPhone: ${conf.estado}${conf.mensaje ? ` — ${conf.mensaje}` : ''}`);
      if (primeraVez) await marcarEventoAtendido('payphone', `resp:${transaccionId}`, `rechazado (${conf.estado})`);
      return aResultado('rechazado', intentId);
    }

    // ⚠️ SE COMPRUEBA EL IMPORTE, y no es paranoia barata: lo que la pasarela dice que
    // cobró es la única cifra que existe de verdad. Si no coincide con lo que este cobro
    // debía valer, algo se manipuló o algo se calculó mal — y en cualquiera de los dos
    // casos emitir una factura sería peor que no emitirla.
    const esperado = centavos(Number(intento.charge_amount) || 0);
    const cobrado = conf.importe != null ? centavos(conf.importe) : null;
    if (cobrado != null && cobrado !== esperado) {
      const aviso = `PayPhone cobró ${conf.importe} $ y este cobro era de ${intento.charge_amount} $. NO se emitió factura.`;
      await marcarFallido(intentId, aviso);
      console.error(`[pagos] ⚠️ descuadre de importe en el cobro ${intentId}: ${aviso}`);
      if (primeraVez) await marcarEventoAtendido('payphone', `resp:${transaccionId}`, 'descuadre de importe');
      return aResultado('descuadre', intentId);
    }

    const r = await confirmarPago(intentId, {
      referencia: String(conf.transactionId ?? transaccionId),
      metodo: 'card',
      estadoProveedor: `${conf.estado}${conf.autorizacion ? ` · aut. ${conf.autorizacion}` : ''}`,
    });

    if (primeraVez) {
      await marcarEventoAtendido('payphone', `resp:${transaccionId}`,
        r.yaEstaba ? 'ya estaba pagado' : `factura ${r.invoiceId ?? 'pendiente'}${r.error ? ` · ${r.error}` : ''}`);
    }

    return aResultado('pagado', intentId);
  } catch (err: any) {
    // ⚠️ El cliente PUEDE haber pagado aunque esto falle. No se le dice que falló el pago:
    // se le dice que estamos verificando, y queda el registro para revisarlo a mano.
    console.error(`[pagos] error confirmando el cobro ${intentId} de PayPhone:`, err.message);
    await pool.query(
      `UPDATE gcc_world.payment_intents SET failure_reason = $2, updated_at = NOW() WHERE id = $1`,
      [intentId, `No se pudo confirmar contra PayPhone: ${err.message}`],
    ).catch(() => {});
    return aResultado('verificando', intentId);
  }
}
