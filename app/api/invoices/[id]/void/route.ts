import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { signCreditNoteXml } from 'ec-sri-invoice-signer';
import { buildCreditNoteXml } from '@/lib/integrations/sri/credit-note-builder';
import { enviarComprobante, consultarAutorizacion } from '@/lib/integrations/sri/soap-client';
import { revertSubscriptionPaymentForVoidedInvoice } from '@/lib/subscriptions';
import fs from 'fs';

function loadP12(): Buffer {
  if (process.env.SRI_P12_BASE64) return Buffer.from(process.env.SRI_P12_BASE64, 'base64');
  const path = process.env.SRI_P12_PATH || '';
  if (path && fs.existsSync(path)) return fs.readFileSync(path);
  throw new Error('Certificado .p12 no encontrado');
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const { motivo } = await req.json();
    if (!motivo?.trim()) return NextResponse.json({ error: 'Motivo de anulacion requerido' }, { status: 400 });

    // Get invoice
    const { rows: [inv] } = await pool.query(
      `SELECT * FROM gcc_world.invoices WHERE id = $1`, [id]
    );
    if (!inv) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    if (inv.sri_status !== 'authorized') return NextResponse.json({ error: 'Solo se pueden anular facturas autorizadas' }, { status: 400 });

    // Get items
    const { rows: items } = await pool.query(`SELECT * FROM gcc_world.invoice_items_sri WHERE invoice_id = $1`, [id]);

    // Get next credit note sequential.
    // NOTE: las notas de crédito se guardan dentro de invoices.sri_response.credit_note.numero
    // (formato "NC-001-001-000000001"), no como filas independientes — por eso leemos desde ahí.
    const { rows: [{ next }] } = await pool.query(
      `SELECT COALESCE(MAX(
                CAST(SPLIT_PART((sri_response::json->'credit_note'->>'numero'), '-', 4) AS INTEGER)
              ), 0) + 1 AS next
       FROM gcc_world.invoices
       WHERE sri_response IS NOT NULL
         AND sri_response::text LIKE '%credit_note%'`
    );
    const secuencial = Math.max(next, 1);

    // Format original invoice date
    const invDate = new Date(inv.created_at);
    const facturaFecha = `${String(invDate.getDate()).padStart(2, '0')}/${String(invDate.getMonth() + 1).padStart(2, '0')}/${invDate.getFullYear()}`;

    if (!inv.client_id_type) {
      return NextResponse.json({ error: 'La factura no tiene tipo de identificación registrado. Actualiza el registro en BD antes de anular.' }, { status: 400 });
    }

    // Build credit note XML
    const { xml, claveAcceso, numero } = buildCreditNoteXml({
      secuencial,
      fecha: new Date(),
      facturaNumero: inv.invoice_number,
      facturaFecha,
      clienteIdTipo: inv.client_id_type,
      clienteRuc: inv.client_ruc || '9999999999999',
      clienteNombre: inv.client_name_sri || 'CONSUMIDOR FINAL',
      clienteDireccion: inv.client_address_sri || 'N/A',
      clienteEmail: inv.client_email_sri || '',
      motivo: motivo.trim(),
      items: items.map((it: any) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        discount: 0,
        ivaRate: Number(it.iva_rate) || 0,
      })),
    });

    // Sign
    const p12 = loadP12();
    const password = process.env.SRI_P12_PASSWORD || '';
    const signedXml = signCreditNoteXml(xml, p12, { pkcs12Password: password });

    // Send to SRI
    const recepcion = await enviarComprobante(signedXml);
    if (!recepcion.ok) {
      const msgs = recepcion.comprobantes[0]?.mensajes?.map(m => m.informacionAdicional || m.mensaje).join('; ') || 'Error';
      console.error('[void] SRI recepcion rejected:', JSON.stringify(recepcion, null, 2));
      return NextResponse.json({ ok: false, error: `SRI rechazo: ${msgs}`, claveAcceso, numero, recepcion });
    }

    // Wait and check authorization
    await new Promise(r => setTimeout(r, 3000));
    const auth = await consultarAutorizacion(claveAcceso);

    if (auth.autorizado) {
      // Mark invoice as cancelled
      await pool.query(
        `UPDATE gcc_world.invoices SET status = 'cancelled', sri_status = 'voided', sri_response = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify({ credit_note: { numero: `NC-${numero}`, claveAcceso, autorizacion: auth.numeroAutorizacion, motivo: motivo.trim() } }), id]
      );

      // If this invoice came from a subscription month, revert that month back to
      // pending (and drop its income) so it can be charged again.
      let subscriptionReverted = false;
      if (inv.source_type === 'subscription') {
        try {
          subscriptionReverted = await revertSubscriptionPaymentForVoidedInvoice(Number(id));
        } catch (e: any) {
          console.error('[void] subscription revert error:', e.message);
        }
      }

      return NextResponse.json({ ok: true, creditNote: `NC-${numero}`, autorizacion: auth.numeroAutorizacion, subscriptionReverted });
    } else {
      const msgs = auth.mensajes?.map(m => m.informacionAdicional || m.mensaje).join('; ') || 'No autorizado';
      console.error('[void] SRI authorization failed:', JSON.stringify(auth, null, 2));
      return NextResponse.json({ ok: false, error: `SRI no autorizo la nota de credito: ${msgs}`, claveAcceso, numero, auth });
    }
  } catch (err: any) {
    console.error('Void error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
