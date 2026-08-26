/**
 * COBRAR UNA ETAPA. La puerta única de los tres canales.
 *
 * El navegador manda el token que le dio la pasarela (nunca el número de tarjeta, que no
 * pasa por aquí) y los datos de facturación. **El importe no llega de fuera**: se vuelve
 * a calcular desde la etapa, porque un importe que viaja por el cliente es un importe
 * que el cliente puede cambiar.
 *
 * Con tarjeta la respuesta es inmediata; con transferencia se devuelve la URL del banco y
 * el pago se confirma después por webhook. Por eso la respuesta lleva un `estado` y no un
 * simple «ok».
 */
import { NextRequest, NextResponse } from 'next/server';
import { autorizarCobro, SinAcceso } from '@/lib/pagos/acceso';
import { cotizarCobro, idMesSuscripcion, crearIntento, anotarRespuestaProveedor, confirmarPago, type DatosFacturacion } from '@/lib/pagos/intentos';
import { proveedorActivo } from '@/lib/pagos';
import { pool } from '@/lib/db';

/**
 * Tipos de identificación del comprador (tabla 6 de la Ficha Técnica del SRI).
 *
 * ⚠️ EL `08` NO ES OPCIONAL, y faltaba. Es «Identificación del exterior», el que llevan los
 * clientes de fuera de Ecuador —GCC ya tiene uno costarricense facturado con él— y sin
 * ponerlo en esta lista **el cliente extranjero no podía pagar**: su cuenta de facturación
 * venía prellenada con `08`, el validador lo rechazaba, y el cobro moría con un «tipo de
 * identificación no válido» que además no dice nada útil. Se descubrió probando el cobro de
 * un ticket real, no leyendo el código.
 *
 * Y duele el doble: el cliente de fuera es justo el que paga con tarjeta internacional, que
 * es una de las razones por las que se eligió PayPhone.
 */
const ID_TYPES = ['04', '05', '06', '07', '08'];

/** Los que NO son un número ecuatoriano de 10 o 13 dígitos: pasaporte e identificación del exterior. */
const ID_TYPES_LIBRES = ['06', '08'];

/** Valida lo que el cliente escribió. Un dato malo aquí sale como comprobante rechazado por el SRI. */
function validarFacturacion(f: any): DatosFacturacion {
  let name = String(f?.name || '').trim();
  let ruc = String(f?.ruc || '').trim();
  const email = String(f?.email || '').trim();
  const id_type = String(f?.id_type || '').trim();

  // CONSUMIDOR FINAL no lleva identificación: el SRI espera el 9999999999999 y ese nombre
  // exacto. Pedírselos al cliente sería obligarle a escribir trece nueves a mano para que
  // el emisor los sustituya igualmente (`createManualInvoice` ya lo hace).
  if (id_type === '07') {
    ruc = '9999999999999';
    if (!name) name = 'CONSUMIDOR FINAL';
  }

  if (!name) throw new Error('Falta la razón social o el nombre para la factura.');
  if (name.length > 300) throw new Error('La razón social no puede pasar de 300 caracteres.');
  if (!ID_TYPES.includes(id_type)) throw new Error('Tipo de identificación no válido.');
  // Un pasaporte o una identificación del exterior tienen el formato de su país
  // («3-101-619800» en Costa Rica): exigirles dígitos ecuatorianos los dejaría fuera.
  if (!ID_TYPES_LIBRES.includes(id_type) && !/^\d{10}$|^\d{13}$/.test(ruc)) {
    throw new Error('La identificación debe tener 10 dígitos (cédula) o 13 (RUC).');
  }
  if (ID_TYPES_LIBRES.includes(id_type) && (ruc.length < 3 || ruc.length > 20)) {
    throw new Error('La identificación no es válida.');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('El correo no es válido.');

  return {
    id_type, ruc, name, email,
    phone: String(f?.phone || '').trim().slice(0, 30) || null,
    address: String(f?.address || '').trim().slice(0, 300) || null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const cuerpo = await req.json();
    const auth = await autorizarCobro({
      sourceType: cuerpo.tipo
        || (cuerpo.producto_id ? 'product' : cuerpo.sub_id ? 'subscription' : cuerpo.ticket_id ? 'ticket' : 'project'),
      sourceId: cuerpo.producto_id ? `p${cuerpo.producto_id}-u0`
        : cuerpo.sub_id && cuerpo.periodo ? idMesSuscripcion(cuerpo.sub_id, String(cuerpo.periodo))
        : (cuerpo.ticket_id ?? cuerpo.project_id),
      stageId: cuerpo.stage_id,
      linkToken: cuerpo.link || null,
    });

    const metodo = cuerpo.metodo === 'transfer' ? 'transfer' : 'card';
    const facturacion = validarFacturacion(cuerpo.facturacion);
    const proveedor = proveedorActivo();

    // Con PayPhone el cobro lo ejecuta la Cajita en el navegador, así que aquí no llega
    // ningún token: se pide DESPUÉS de crear el intento, porque el identificador que la
    // Cajita necesita ES el id del intento.
    const token = String(cuerpo.token || '').trim();
    if (!proveedor.cobraEnCliente && !token) {
      return NextResponse.json({ error: 'Falta el token de la pasarela.' }, { status: 400 });
    }
    if (!proveedor.metodos().includes(metodo)) {
      return NextResponse.json({ error: `La pasarela no admite ${metodo === 'transfer' ? 'transferencias' : 'tarjetas'}.` }, { status: 400 });
    }

    // El importe se recalcula SIEMPRE aquí. Y `cotizarEtapa` vuelve a comprobar contra la
    // base que la etapa siga sin facturar: entre abrir la pantalla y pulsar «pagar» pudo
    // facturarla alguien desde el módulo de facturas.
    const etapa = await cotizarCobro(auth, proveedor.nombre);

    const intento = await crearIntento({
      etapa,
      canal: auth.canal,
      facturacion,
      payerEmail: facturacion.email,
      createdBy: auth.solicitante.tipo === 'enlace' ? null : auth.solicitante.userId,
    });

    if (auth.solicitante.tipo === 'enlace') {
      await pool.query(
        `UPDATE gcc_world.payment_links SET intent_id = $1, opened_at = COALESCE(opened_at, NOW()) WHERE id = $2`,
        [intento.id, auth.solicitante.linkId],
      );
    }

    // ── Proveedores que cobran EN EL NAVEGADOR (PayPhone) ────────────────────
    // El intento ya existe, así que se devuelven los parámetros de su widget y se acaba
    // aquí: quien cobra es el cliente, y quien confirma es `/pagos/respuesta`. Marcarlo
    // como pagado en este punto sería mentir — todavía no ha pagado nadie.
    if (proveedor.cobraEnCliente && proveedor.parametrosCliente) {
      await anotarRespuestaProveedor(intento.id, { metodo, procesando: true, estado: 'Esperando al cliente' });
      return NextResponse.json({
        estado: 'cajita',
        intentId: intento.id,
        importes: { neto: intento.neto, recargo: intento.recargo, total: intento.total },
        parametros: proveedor.parametrosCliente({
          intentId: intento.id,
          total: intento.total,
          referencia: `${etapa.title} — ${etapa.conceptName}`,
          email: facturacion.email,
          telefono: facturacion.phone,
          documento: facturacion.ruc,
        }),
      });
    }

    const origen = req.nextUrl.origin;
    const urlRetorno = auth.canal === 'link'
      ? `${origen}/pagar/${cuerpo.link}?volviendo=1`
      : `${origen}/dashboard/projects/${auth.projectId}?pago=${intento.id}`;

    let resultado;
    try {
      resultado = await proveedor.crearCobro({
        intentId: intento.id,
        token,
        metodo,
        total: intento.total,
        descripcion: `${etapa.title} — ${etapa.conceptName}`,
        email: facturacion.email,
        meses: Number(cuerpo.meses) > 1 ? Number(cuerpo.meses) : undefined,
        urlRetorno,
      });
    } catch (err: any) {
      await anotarRespuestaProveedor(intento.id, { fallo: err.message });
      // 502 y no 500: el fallo es de la pasarela, no nuestro, y la diferencia importa
      // cuando hay que decidir a quién se llama.
      return NextResponse.json({ error: `La pasarela no respondió: ${err.message}` }, { status: 502 });
    }

    await anotarRespuestaProveedor(intento.id, {
      referencia: resultado.referencia,
      metodo: resultado.metodo,
      estado: resultado.detalleProveedor,
      fallo: resultado.estado === 'rechazado' ? (resultado.motivoFallo || 'Cobro rechazado.') : null,
      procesando: resultado.estado === 'redirigir' || resultado.estado === 'pendiente',
    });

    if (resultado.estado === 'rechazado') {
      return NextResponse.json({
        estado: 'rechazado',
        intentId: intento.id,
        error: resultado.motivoFallo || 'El cobro fue rechazado. Prueba con otra tarjeta.',
      }, { status: 200 });
    }

    if (resultado.estado === 'redirigir') {
      return NextResponse.json({
        estado: 'redirigir',
        intentId: intento.id,
        url: resultado.urlRedireccion,
      });
    }

    // Tarjeta aprobada: se confirma y se emite la factura en el acto. La misma función
    // que usa el webhook, para que el comprobante salga idéntico por cualquier camino.
    const confirmado = await confirmarPago(intento.id, {
      referencia: resultado.referencia,
      metodo: resultado.metodo,
      estadoProveedor: resultado.detalleProveedor,
      esDebito: cuerpo.tipo_tarjeta === 'debito',
    });

    return NextResponse.json({
      estado: 'pagado',
      intentId: intento.id,
      invoiceId: confirmado.invoiceId,
      facturaAutorizada: confirmado.autorizada,
      // Si el cobro entró pero el comprobante falló, el cliente tiene que saber que su
      // dinero está bien y que la factura va en camino. Callarlo genera una reclamación.
      aviso: confirmado.error ? 'El pago se registró correctamente. La factura se emitirá en breve.' : null,
    });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[pagos] cobrar:', err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
