/**
 * QUÉ SE VA A PAGAR — lo que la pantalla de cobro necesita saber antes de cobrar nada.
 *
 * Sirve a los tres canales con la misma respuesta: el cliente con sesión pasa
 * `project_id` + `stage_id`, y el que llega por correo pasa solo `link`. Que la pantalla
 * sea la misma no es ahorro de código: es que el importe que ve el cliente salga del
 * MISMO cálculo que luego se cobra.
 *
 * ⚠️ El importe se calcula aquí, en el servidor, cada vez. Nunca se acepta uno de fuera.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { autorizarCobro, SinAcceso } from '@/lib/pagos/acceso';
import { cotizarEtapa, cobroPagadoDeEtapa } from '@/lib/pagos/intentos';
import { proveedorActivo } from '@/lib/pagos';
import { getBillingForClient } from '@/lib/billing-clients';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const auth = await autorizarCobro({
      projectId: sp.get('project_id') || undefined,
      stageId: sp.get('stage_id') || undefined,
      linkToken: sp.get('link'),
    });

    const proveedor = proveedorActivo();
    const etapa = await cotizarEtapa(auth.projectId, auth.stageId, proveedor.nombre);

    // Si ya está pagada se responde 200 con el aviso, no un error: la pantalla tiene que
    // poder decir «esto ya se pagó» en vez de romperse, sobre todo cuando el cliente
    // vuelve al enlace del correo después de haber pagado.
    const pagada = await cobroPagadoDeEtapa(auth.stageId);

    // Datos de facturación prellenados. Una cuenta por cliente: Fernando lo confirmó el
    // 2026-08-25 («dejemos una sola cuenta de facturación por cliente»).
    let facturacion: any = null;
    const { rows: [proj] } = await pool.query(
      `SELECT p.client_id, p.title, p.description, p.status, c.email AS client_email, c.name AS client_name
         FROM gcc_world.projects p
         LEFT JOIN gcc_world.clients c ON c.id = p.client_id
        WHERE p.id = ($1)::bigint`,
      [String(auth.projectId)],
    );
    if (proj?.client_id) {
      const b = await getBillingForClient(proj.client_id);
      if (b) {
        facturacion = {
          id_type: b.id_type || '05',
          ruc: b.ruc || '',
          name: b.name || '',
          email: b.email || proj.client_email || '',
          phone: b.phone || '',
          address: b.address || '',
        };
      }
    }

    // El plan completo, para que el cliente vea DÓNDE encaja lo que va a pagar. Pagar una
    // etapa suelta sin ver el resto es firmar a ciegas; es la misma información que ya le
    // enseña la página pública del proyecto, y por las mismas razones.
    const { rows: etapasPlan } = await pool.query(
      `SELECT e.id, e.name, e.amount, (e.invoice_id IS NOT NULL) AS facturada
         FROM gcc_world.project_stages e
         LEFT JOIN gcc_world.invoices i ON i.id = e.invoice_id AND i.status <> 'cancelled'
        WHERE e.project_id = ($1)::bigint
        ORDER BY e.sort_order, e.id`,
      [String(auth.projectId)],
    );

    return NextResponse.json({
      proyecto: {
        id: etapa.projectId,
        titulo: etapa.projectTitle,
        // ⚠️ Nada de requerimientos, miembros ni costos internos: es la misma línea que
        // Fernando trazó el 2026-08-19 para la página pública del proyecto — el cliente ve
        // el ACUERDO, no el reparto del trabajo.
        descripcion: proj?.description || null,
        estado: proj?.status || null,
        cliente: proj?.client_name || null,
        etapas: etapasPlan.map((e: any) => ({
          id: Number(e.id),
          nombre: e.name,
          importe: Number(e.amount) || 0,
          facturada: e.facturada,
          esLaQueSePaga: Number(e.id) === etapa.stageId,
        })),
      },
      etapa: { id: etapa.stageId, nombre: etapa.stageName },
      importes: { neto: etapa.neto, recargo: etapa.recargo, total: etapa.total },
      pasarela: {
        proveedor: proveedor.nombre,
        metodos: proveedor.metodos(),
        // La clave PÚBLICA es la que tokeniza en el navegador; la privada no sale de aquí.
        clavePublica: process.env.KUSHKI_PUBLIC_MERCHANT_ID || null,
        entorno: process.env.KUSHKI_ENV === 'production' ? 'production' : 'uat',
      },
      facturacion,
      correoDestino: auth.solicitante.tipo === 'enlace' ? auth.solicitante.email : (facturacion?.email || null),
      canal: auth.canal,
      yaPagada: pagada ? { invoiceId: pagada.invoice_id } : null,
    });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    // Con la traza: un «no se pudo cargar el pago» sin stack en el registro obliga a
    // adivinar, y esto es la pantalla por la que entra el dinero.
    console.error('[pagos] etapa:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
