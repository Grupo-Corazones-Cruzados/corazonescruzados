import { pool } from '@/lib/db';
import { buildFacturaXml, InvoiceData, InvoiceItem } from './xml-builder';
import { signXml } from './xades-signer';
import { enviarComprobante, consultarAutorizacion } from './soap-client';
import { generateRidePdf } from './ride-pdf';
import { SRI_CONFIG } from './config';

async function ensureSriColumns() {
  await pool.query(`
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(20);
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS access_key VARCHAR(49);
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS authorization_number VARCHAR(49);
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS authorization_date TIMESTAMPTZ;
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS ruc_emisor VARCHAR(13);
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS razon_social_emisor VARCHAR(300);
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS client_ruc VARCHAR(13);
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS client_name_sri VARCHAR(300);
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS client_email_sri VARCHAR(255);
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS client_phone_sri VARCHAR(20);
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS client_address_sri TEXT;
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS subtotal_0 NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS subtotal_iva NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS iva_amount NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS sri_status VARCHAR(20) DEFAULT 'generated';
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS sri_response TEXT;
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS xml_signed TEXT;
    ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS pdf_data BYTEA;
    CREATE TABLE IF NOT EXISTS gcc_world.invoice_items_sri (
      id SERIAL PRIMARY KEY,
      invoice_id INT NOT NULL,
      description TEXT NOT NULL,
      quantity NUMERIC(12,2) DEFAULT 1,
      unit_price NUMERIC(12,2) NOT NULL,
      subtotal NUMERIC(12,2) NOT NULL,
      iva_rate NUMERIC(5,2) DEFAULT 0,
      iva_amount NUMERIC(12,2) DEFAULT 0
    );
  `);
}

/**
 * Get next sequential number
 */
// Minimum sequential — must be higher than the last invoice emitted outside this system
const SRI_MIN_SECUENCIAL = 23;

async function getNextSecuencial(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER)), 0) + 1 as next
     FROM gcc_world.invoices`
  );
  return Math.max(rows[0].next, SRI_MIN_SECUENCIAL);
}

/**
 * Create invoice from project data (triggered when project → completed)
 */
interface InvoiceOptions {
  clientIdType?: string;
  paymentCode?: string;
  invoiceItems?: { description: string; quantity: number; unitPrice: number; ivaRate: number; discount: number }[];
  additionalFields?: { name: string; value: string }[];
}

export async function createInvoiceFromProject(projectId: string, options?: InvoiceOptions): Promise<number> {
  const clientIdType = options?.clientIdType;
  await ensureSriColumns();

  // Ensure clients table has ruc and address columns
  await pool.query(`
    ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS ruc VARCHAR(13);
    ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS address TEXT;
  `);

  // Get project with requirements and client
  const { rows: [project] } = await pool.query(
    `SELECT p.*, c.name as client_name, c.email as client_email, c.phone as client_phone,
            c.ruc as client_ruc, c.address as client_address
     FROM gcc_world.projects p
     LEFT JOIN gcc_world.clients c ON c.id = p.client_id
     WHERE p.id = $1`, [projectId]
  );
  if (!project) throw new Error('Proyecto no encontrado');

  // Get accepted requirement assignments for items
  const { rows: reqs } = await pool.query(
    `SELECT r.title, r.description,
            COALESCE(SUM(COALESCE(ra.member_cost, ra.proposed_cost)), r.cost, 0) as cost
     FROM gcc_world.project_requirements r
     LEFT JOIN gcc_world.requirement_assignments ra ON ra.requirement_id = r.id AND ra.status = 'accepted'
     WHERE r.project_id = $1
     GROUP BY r.id, r.title, r.description, r.cost
     ORDER BY r.id`, [projectId]
  );

  // Use items from form if provided, otherwise build from requirements
  const items: InvoiceItem[] = options?.invoiceItems?.length
    ? options.invoiceItems.map(it => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        ivaRate: it.ivaRate,
        discount: it.discount || 0,
      }))
    : reqs.length > 0
    ? reqs.map((r: any) => ({
        description: r.title + (r.description ? ` - ${r.description}` : ''),
        quantity: 1,
        unitPrice: Number(r.cost) || 0,
        ivaRate: 0,
      }))
    : [{
        description: `Servicios del proyecto: ${project.title}`,
        quantity: 1,
        unitPrice: Number(project.final_cost) || 0,
        ivaRate: 0,
      }];

  const secuencial = await getNextSecuencial();
  const fecha = new Date();

  // If consumer final, force correct values
  const isConsumidorFinal = !project.client_ruc || project.client_ruc === '9999999999999' || clientIdType === '07';

  const invoiceData: InvoiceData = {
    secuencial,
    fecha,
    clienteIdTipo: isConsumidorFinal ? '07' : clientIdType,
    clienteRuc: isConsumidorFinal ? '9999999999999' : project.client_ruc,
    clienteNombre: isConsumidorFinal ? 'CONSUMIDOR FINAL' : (project.client_name || 'CONSUMIDOR FINAL'),
    clienteDireccion: project.client_address || 'N/A',
    clienteEmail: project.client_email || '',
    clienteTelefono: project.client_phone || '',
    items,
    payments: options?.paymentCode ? [{ code: options.paymentCode, total: 0 }] : undefined, // total gets calculated in xml-builder
    additionalFields: options?.additionalFields?.filter(f => f.name && f.value),
  };

  // Build XML
  const { xml, claveAcceso, numeroFactura } = buildFacturaXml(invoiceData);

  // Calculate totals
  const subtotal0 = items.filter(i => i.ivaRate === 0).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const subtotalIva = items.filter(i => i.ivaRate > 0).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const ivaMonto = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.ivaRate / 100), 0);
  const total = subtotal0 + subtotalIva + ivaMonto;

  // Insert invoice — 'total' is a generated column (subtotal + tax), don't insert it
  const { rows: [invoice] } = await pool.query(
    `INSERT INTO gcc_world.invoices (project_id, client_id, subtotal, tax, status, invoice_number, access_key, ruc_emisor, razon_social_emisor, client_ruc, client_name_sri, client_email_sri, client_phone_sri, client_address_sri, subtotal_0, subtotal_iva, iva_amount, sri_status, xml_signed)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'generated', $17) RETURNING id`,
    [projectId, project.client_id, (subtotal0 + subtotalIva).toFixed(2), ivaMonto.toFixed(2), numeroFactura, claveAcceso,
     SRI_CONFIG.ruc, SRI_CONFIG.razonSocial,
     invoiceData.clienteRuc, invoiceData.clienteNombre, invoiceData.clienteEmail, invoiceData.clienteTelefono, invoiceData.clienteDireccion,
     subtotal0.toFixed(2), subtotalIva.toFixed(2), ivaMonto.toFixed(2), xml]
  );

  // Insert items
  for (const item of items) {
    const sub = Math.round(item.quantity * item.unitPrice * 100) / 100;
    const iva = Math.round(sub * (item.ivaRate / 100) * 100) / 100;
    await pool.query(
      `INSERT INTO gcc_world.invoice_items_sri (invoice_id, description, quantity, unit_price, subtotal, iva_rate, iva_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [invoice.id, item.description, item.quantity, item.unitPrice, sub, item.ivaRate, iva]
    );
  }

  return invoice.id;
}

/**
 * Sign and send invoice to SRI
 */
export async function sendInvoiceToSri(invoiceId: number): Promise<{
  ok: boolean;
  authorized: boolean;
  authNumber?: string;
  error?: string;
}> {
  const { rows: [invoice] } = await pool.query(`SELECT * FROM gcc_world.invoices WHERE id = $1`, [invoiceId]);
  if (!invoice) throw new Error('Factura no encontrada');

  try {
    // Sign XML
    const xmlSigned = signXml(invoice.xml_signed);
    await pool.query(`UPDATE gcc_world.invoices SET xml_signed = $1, sri_status = 'signed', updated_at = NOW() WHERE id = $2`, [xmlSigned, invoiceId]);

    // Send to SRI
    const recepcion = await enviarComprobante(xmlSigned);
    await pool.query(`UPDATE gcc_world.invoices SET sri_response = $1, sri_status = $2, updated_at = NOW() WHERE id = $3`,
      [JSON.stringify(recepcion), recepcion.ok ? 'sent' : 'rejected', invoiceId]);

    if (!recepcion.ok) {
      const msgs = recepcion.comprobantes[0]?.mensajes?.map(m => m.mensaje).join('; ') || 'Error desconocido';
      return { ok: false, authorized: false, error: msgs };
    }

    // Wait 2 seconds then check authorization
    await new Promise(r => setTimeout(r, 2000));

    const auth = await consultarAutorizacion(invoice.access_key);
    if (auth.autorizado) {
      await pool.query(
        `UPDATE gcc_world.invoices SET authorization_number = $1, authorization_date = $2, sri_status = 'authorized', updated_at = NOW() WHERE id = $3`,
        [auth.numeroAutorizacion, auth.fechaAutorizacion || new Date().toISOString(), invoiceId]
      );

      // Generate PDF
      const { rows: items } = await pool.query(`SELECT * FROM gcc_world.invoice_items_sri WHERE invoice_id = $1 ORDER BY id`, [invoiceId]);
      const pdfBuffer = await generateRidePdf({
        claveAcceso: invoice.access_key,
        numeroAutorizacion: auth.numeroAutorizacion,
        fechaAutorizacion: auth.fechaAutorizacion || new Date().toISOString(),
        numeroFactura: invoice.invoice_number,
        fechaEmision: new Date(invoice.created_at).toLocaleDateString('es-EC'),
        clienteNombre: invoice.client_name_sri,
        clienteRuc: invoice.client_ruc,
        clienteDireccion: invoice.client_address_sri || '',
        clienteEmail: invoice.client_email_sri || '',
        clienteTelefono: invoice.client_phone_sri || '',
        formaPago: options?.paymentCode || '20',
        items: items.map((it: any) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unit_price),
          subtotal: Number(it.subtotal),
          ivaRate: Number(it.iva_rate),
          discount: Number(it.iva_amount) === 0 ? 0 : undefined,
        })),
        subtotal0: Number(invoice.subtotal_0),
        subtotalIva: Number(invoice.subtotal_iva),
        ivaMonto: Number(invoice.iva_amount),
        total: Number(invoice.total),
      });

      await pool.query(`UPDATE gcc_world.invoices SET pdf_data = $1, updated_at = NOW() WHERE id = $2`, [pdfBuffer, invoiceId]);

      return { ok: true, authorized: true, authNumber: auth.numeroAutorizacion };
    } else {
      const msgs = auth.mensajes?.map(m => m.mensaje).join('; ') || 'No autorizado';
      await pool.query(`UPDATE gcc_world.invoices SET sri_response = $1, sri_status = 'rejected', updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(auth), invoiceId]);
      return { ok: true, authorized: false, error: msgs };
    }
  } catch (err: any) {
    await pool.query(`UPDATE gcc_world.invoices SET sri_status = 'error', sri_response = $1, updated_at = NOW() WHERE id = $2`,
      [err.message, invoiceId]);
    return { ok: false, authorized: false, error: err.message };
  }
}
