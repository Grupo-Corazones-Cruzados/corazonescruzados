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
import { deducirIdentificacion } from '@/lib/pagos/identificacion';
import { CUENTAS_BANCARIAS } from '@/lib/pagos/cuentas';
import { pool } from '@/lib/db';

/**
 * Valida lo que el cliente escribió y **deduce** su tipo de identificación.
 *
 * ⚠️ EL `id_type` YA NO SE ACEPTA DEL FORMULARIO. Desde el 2026-08-26 se pregunta el **país**
 * y el número, y el tipo del SRI se deduce aquí (ver `lib/pagos/identificacion.ts`).
 * Aceptarlo de fuera dejaría que cualquiera mandara un cobro con el tipo que le apeteciera y
 * el comprobante saldría mal emitido — con el dinero ya cobrado.
 *
 * Un dato malo aquí sale como comprobante rechazado por el SRI, así que se para antes.
 */
function validarFacturacion(f: any): DatosFacturacion & { pais: string } {
  const name = String(f?.name || '').trim();
  const email = String(f?.email || '').trim();
  const pais = String(f?.pais || '').trim();
  const numero = String(f?.ruc || f?.identificacion || '').trim();

  if (!name) throw new Error('Falta la razón social o el nombre para la factura.');
  if (name.length > 300) throw new Error('La razón social no puede pasar de 300 caracteres.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('El correo no es válido.');

  const id = deducirIdentificacion(pais, numero);
  if (!id.ok) throw new Error(id.error);

  return {
    id_type: id.valor.idType,
    ruc: numero,
    name, email, pais,
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
    // ⚠️ LA TRANSFERENCIA NO LA OFRECE LA PASARELA, LA OFRECE GCC.
    //
    // `proveedor.metodos()` dice qué sabe cobrar PayPhone —hoy, tarjeta— y la transferencia
    // bancaria no pasa por ahí: el cliente va a su banco, transfiere a nuestra cuenta y sube
    // el comprobante. Por eso no se valida contra el proveedor; si se hiciera, activar
    // PayPhone (que no da transferencias) apagaría un método que no es suyo.
    if (metodo !== 'transfer' && !proveedor.metodos().includes(metodo)) {
      return NextResponse.json({ error: 'La pasarela no admite este medio de pago.' }, { status: 400 });
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
      metodo,
    });

    if (auth.solicitante.tipo === 'enlace') {
      await pool.query(
        `UPDATE gcc_world.payment_links SET intent_id = $1, opened_at = COALESCE(opened_at, NOW()) WHERE id = $2`,
        [intento.id, auth.solicitante.linkId],
      );
    }

    // ── TRANSFERENCIA BANCARIA ───────────────────────────────────────────────
    // No se cobra nada aquí: se le enseñan las cuentas y el cobro queda esperando su
    // comprobante. El importe es el neto, sin recargo — no hay comisión que trasladar.
    if (metodo === 'transfer') {
      await anotarRespuestaProveedor(intento.id, {
        metodo: 'transfer', procesando: true, estado: 'Esperando el comprobante del cliente',
      });
      return NextResponse.json({
        estado: 'transferencia',
        intentId: intento.id,
        importes: { neto: intento.neto, recargo: intento.recargo, total: intento.total },
        cuentas: CUENTAS_BANCARIAS,
      });
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
