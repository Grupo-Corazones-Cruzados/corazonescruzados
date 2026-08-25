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
import { cotizarEtapa, crearIntento, anotarRespuestaProveedor, confirmarPago, type DatosFacturacion } from '@/lib/pagos/intentos';
import { proveedorActivo } from '@/lib/pagos';
import { pool } from '@/lib/db';

const ID_TYPES = ['04', '05', '06', '07'];

/** Valida lo que el cliente escribió. Un dato malo aquí sale como comprobante rechazado por el SRI. */
function validarFacturacion(f: any): DatosFacturacion {
  const name = String(f?.name || '').trim();
  const ruc = String(f?.ruc || '').trim();
  const email = String(f?.email || '').trim();
  const id_type = String(f?.id_type || '').trim();

  if (!name) throw new Error('Falta la razón social o el nombre para la factura.');
  if (name.length > 300) throw new Error('La razón social no puede pasar de 300 caracteres.');
  if (!ID_TYPES.includes(id_type)) throw new Error('Tipo de identificación no válido.');
  if (!/^\d{10}$|^\d{13}$/.test(ruc) && id_type !== '06') {
    throw new Error('La identificación debe tener 10 dígitos (cédula) o 13 (RUC).');
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
      projectId: cuerpo.project_id,
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
    const etapa = await cotizarEtapa(auth.projectId, auth.stageId, proveedor.nombre);

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
          referencia: `${etapa.projectTitle} — ${etapa.stageName}`,
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
        descripcion: `${etapa.projectTitle} — ${etapa.stageName}`,
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
