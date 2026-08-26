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
import { cotizarCobro, cobroPagadoDe, idMesSuscripcion, partesMesSuscripcion, partesAltaProducto } from '@/lib/pagos/intentos';
import { proveedorActivo } from '@/lib/pagos';
import { getBillingForClient } from '@/lib/billing-clients';
import { CUENTAS_BANCARIAS } from '@/lib/pagos/cuentas';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    // Una suscripción se identifica por `<id>-<AAAA-MM>`: el mes es parte de lo que se
    // cobra, no un parámetro suelto (ver `idMesSuscripcion`).
    const subId = sp.get('sub_id');
    const periodo = sp.get('periodo');
    const productoId = sp.get('producto_id');
    const auth = await autorizarCobro({
      sourceType: sp.get('tipo')
        || (productoId ? 'product' : subId ? 'subscription' : sp.get('ticket_id') ? 'ticket' : 'project'),
      // El id del producto viaja «pelado»: `autorizarCobro` le pega el comprador desde la
      // sesión, porque ese dato no se acepta de fuera.
      sourceId: productoId ? `p${productoId}-u0`
        : subId && periodo ? idMesSuscripcion(subId, periodo)
        : (sp.get('ticket_id') || sp.get('project_id') || undefined),
      stageId: sp.get('stage_id') || undefined,
      linkToken: sp.get('link'),
    });

    const proveedor = proveedorActivo();
    const etapa = await cotizarCobro(auth, proveedor.nombre);

    // Si ya está pagada se responde 200 con el aviso, no un error: la pantalla tiene que
    // poder decir «esto ya se pagó» en vez de romperse, sobre todo cuando el cliente
    // vuelve al enlace del correo después de haber pagado.
    const pagada = await cobroPagadoDe(auth);

    // Datos de facturación prellenados. Una cuenta por cliente: Fernando lo confirmó el
    // 2026-08-25 («dejemos una sola cuenta de facturación por cliente»).
    //
    // ⚠️ En un PRODUCTO el comprador puede no ser cliente todavía —esa es justo la gracia del
    // marketplace—, así que el formulario sale vacío y él escribe sus datos. Se prellena solo
    // si resulta que ya tenía cuenta de facturación, buscándola por su correo.
    let facturacion: any = null;
    const esTicket = auth.sourceType === 'ticket';
    const esSuscripcion = auth.sourceType === 'subscription';
    const esProducto = auth.sourceType === 'product';
    const idPropio = esProducto ? partesAltaProducto(auth.sourceId).itemId
      : esSuscripcion ? partesMesSuscripcion(auth.sourceId).subId
      : auth.sourceId;
    const { rows: [proj] } = await pool.query(
      esProducto
        ? `SELECT NULL::bigint AS client_id, i.title, i.description, 'active' AS status,
                  NULL::text AS client_email, NULL::text AS client_name
             FROM gcc_world.member_portfolio_items i WHERE i.id = ($1)::bigint`
        : esSuscripcion
        ? `SELECT s.client_id, s.title, s.notes AS description, s.status,
                  COALESCE(c.email, s.client_email_sri) AS client_email,
                  COALESCE(c.name, s.client_name_sri) AS client_name
             FROM gcc_world.subscriptions s
             LEFT JOIN gcc_world.clients c ON c.id = s.client_id
            WHERE s.id = ($1)::bigint`
        : esTicket
        ? `SELECT t.client_id, t.title, t.description, t.status, c.email AS client_email, c.name AS client_name
             FROM gcc_world.tickets t
             LEFT JOIN gcc_world.clients c ON c.id = t.client_id
            WHERE t.id = ($1)::bigint`
        : `SELECT p.client_id, p.title, p.description, p.status, c.email AS client_email, c.name AS client_name
             FROM gcc_world.projects p
             LEFT JOIN gcc_world.clients c ON c.id = p.client_id
            WHERE p.id = ($1)::bigint`,
      [idPropio],
    );
    const clienteParaPrellenar = proj?.client_id
      || (esProducto ? (await pool.query(
            `SELECT id FROM gcc_world.clients WHERE LOWER(email) = LOWER($1) LIMIT 1`,
            [auth.solicitante.email],
          )).rows[0]?.id : null);
    if (clienteParaPrellenar) {
      const b = await getBillingForClient(clienteParaPrellenar);
      if (b) {
        facturacion = {
          // El país es lo que ahora se pregunta; si la cuenta guardada no lo tiene, se
          // asume Ecuador, que es de donde viene la inmensa mayoría.
          pais: b.country || 'Ecuador',
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
    // Ni un ticket ni una suscripción tienen plan que enseñar: se cobran enteros.
    const { rows: etapasPlan } = (esTicket || esSuscripcion || esProducto) ? { rows: [] as any[] } : await pool.query(
      `SELECT e.id, e.name, e.amount, (e.invoice_id IS NOT NULL) AS facturada
         FROM gcc_world.project_stages e
         LEFT JOIN gcc_world.invoices i ON i.id = e.invoice_id AND i.status <> 'cancelled'
        WHERE e.project_id = ($1)::bigint
        ORDER BY e.sort_order, e.id`,
      [auth.sourceId],
    );

    // ── QUÉ SE ESTÁ PAGANDO, CON DETALLE ─────────────────────────────────────
    //
    // Fernando (2026-08-26): «quisiera que sea una página que muestre el contenido de cada
    // cosa que se vaya a pagar». Antes la pantalla enseñaba el título y poco más, y en un
    // ticket o una suscripción eso deja al cliente pagando algo que no reconoce.
    //
    // Cada origen aporta los datos que **el cliente** necesita para reconocer el cobro — no
    // los que nos sirven a nosotros: nada de costos internos, miembros ni requerimientos.
    const detalle: { etiqueta: string; valor: string }[] = [];
    const fecha = (v: any) => v ? new Date(v).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

    if (esTicket) {
      const { rows: [t] } = await pool.query(
        `SELECT estimated_hours, actual_hours, completed_at, deadline,
                (SELECT name FROM gcc_world.services s WHERE s.id = t.service_id) AS servicio
           FROM gcc_world.tickets t WHERE t.id = ($1)::bigint`, [idPropio]).catch(() => ({ rows: [null] }));
      if (t?.servicio) detalle.push({ etiqueta: 'Servicio', valor: t.servicio });
      const horas = Number(t?.actual_hours) || Number(t?.estimated_hours) || 0;
      if (horas > 0) detalle.push({ etiqueta: 'Horas', valor: `${horas}` });
      if (fecha(t?.completed_at)) detalle.push({ etiqueta: 'Entregado', valor: fecha(t.completed_at)! });
    } else if (esSuscripcion) {
      const { subId, periodo: per } = partesMesSuscripcion(auth.sourceId);
      const { rows: [sub] } = await pool.query(
        `SELECT monthly_cost, start_date FROM gcc_world.subscriptions WHERE id = ($1)::bigint`, [subId]);
      detalle.push({ etiqueta: 'Mes que se paga', valor: etapa.conceptName.split('—').pop()?.trim() || per });
      detalle.push({ etiqueta: 'Mensualidad', valor: `$${Number(sub?.monthly_cost || 0).toFixed(2)}` });
      if (sub?.start_date) detalle.push({ etiqueta: 'Suscrito desde', valor: fecha(sub.start_date)! });
    } else if (esProducto) {
      const { rows: [item] } = await pool.query(
        `SELECT cost, tags, project_url FROM gcc_world.member_portfolio_items WHERE id = ($1)::bigint`, [idPropio]);
      detalle.push({ etiqueta: 'Modalidad', valor: 'Suscripción mensual' });
      detalle.push({ etiqueta: 'Mensualidad', valor: `$${Number(item?.cost || 0).toFixed(2)} al mes` });
      if (Array.isArray(item?.tags) && item.tags.length) {
        detalle.push({ etiqueta: 'Incluye', valor: item.tags.join(' · ') });
      }
      detalle.push({ etiqueta: 'Después del primer mes', valor: 'Los siguientes los pagas desde Suscripciones' });
    } else {
      const { rows: [p2] } = await pool.query(
        `SELECT deadline, final_cost FROM gcc_world.projects WHERE id = ($1)::bigint`, [idPropio]);
      detalle.push({ etiqueta: 'Etapa que se paga', valor: etapa.conceptName });
      if (Number(p2?.final_cost) > 0) detalle.push({ etiqueta: 'Total del proyecto', valor: `$${Number(p2.final_cost).toFixed(2)}` });
      if (fecha(p2?.deadline)) detalle.push({ etiqueta: 'Entrega prevista', valor: fecha(p2.deadline)! });
    }

    return NextResponse.json({
      detalle,
      // Los dos importes, para que el cliente elija con el número delante: la transferencia
      // no lleva recargo porque ahí no cobra ninguna pasarela.
      importesPorMetodo: etapa.importes,
      cuentas: CUENTAS_BANCARIAS,
      proyecto: {
        id: Number(idPropio),
        tipo: auth.sourceType,
        titulo: etapa.title,
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
      etapa: { id: etapa.stageId, nombre: etapa.conceptName },
      cobro: { tipo: auth.sourceType, id: auth.sourceId, stageId: auth.stageId },
      importes: { neto: etapa.neto, recargo: etapa.recargo, total: etapa.total },
      pasarela: {
        proveedor: proveedor.nombre,
        metodos: proveedor.metodos(),
        // Con PayPhone el cobro lo ejecuta su Cajita en el navegador; la pantalla necesita
        // saberlo para pedir los datos de facturación ANTES y dejarle el pago a ella.
        cobraEnCliente: Boolean(proveedor.cobraEnCliente),
        // ⚠️ Estos dos son SOLO de Kushki, y por eso se anulan con cualquier otro
        // proveedor. Con PayPhone activo la respuesta decía `entorno: "uat"` —un residuo
        // que no significaba nada— y leerlo invita a creer que la pasarela está en pruebas
        // cuando está cobrando de verdad. Un dato que no aplica no se deja «por si acaso»:
        // se apaga, porque el que lo lea va a actuar según lo que diga.
        clavePublica: proveedor.nombre === 'kushki' ? (process.env.KUSHKI_PUBLIC_MERCHANT_ID || null) : null,
        entorno: proveedor.nombre === 'kushki'
          ? (process.env.KUSHKI_ENV === 'production' ? 'production' : 'uat')
          : null,
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
