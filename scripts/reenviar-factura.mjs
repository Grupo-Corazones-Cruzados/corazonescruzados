/**
 * REENVIAR LA FACTURA DE UN COBRO EN LÍNEA.
 *
 * Existe porque el sistema admite que el correo falle: al emitir, `emitirFacturaDelCobro`
 * manda la factura en su propio `try` —el cobro y el comprobante valen igual si el correo
 * no sale— y deja escrito el motivo en `payment_intents.failure_reason`. Sin esta
 * herramienta, ese aviso no tendría arreglo: habría que reenviar a mano desde Gmail con un
 * PDF sacado de la base.
 *
 * Usa la MISMA función que el cobro (`sendPaidInvoiceEmail`), así que el correo reenviado es
 * idéntico al original — no una imitación parecida.
 *
 *   node --import ./scripts/registrar-ts.mjs scripts/reenviar-factura.mjs <invoiceId> [correo]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const invoiceId = Number(process.argv[2]);
if (!invoiceId) {
  console.error('Uso: node --import ./scripts/registrar-ts.mjs scripts/reenviar-factura.mjs <invoiceId> [correo]');
  process.exit(1);
}

const { pool } = await import('@/lib/db');
const { sendPaidInvoiceEmail } = await import('@/lib/integrations/email');

const { rows: [inv] } = await pool.query(
  `SELECT i.invoice_number, i.authorization_number, i.total, i.pdf_data, i.sri_status,
          i.client_email_sri, i.payment_intent_id,
          pi.source_id AS project_id, pi.billing_snapshot,
          p.title AS project_title,
          e.name  AS stage_name
     FROM gcc_world.invoices i
     LEFT JOIN gcc_world.payment_intents pi ON pi.id = i.payment_intent_id
     LEFT JOIN gcc_world.projects p ON p.id = (pi.source_id)::bigint
     LEFT JOIN gcc_world.project_stages e ON e.id = pi.stage_id
    WHERE i.id = $1`,
  [invoiceId],
);

if (!inv) { console.error(`✖ La factura ${invoiceId} no existe.`); process.exit(1); }
if (inv.sri_status !== 'authorized') {
  console.error(`✖ La factura ${inv.invoice_number} no está autorizada por el SRI (${inv.sri_status}). No se reenvía.`);
  process.exit(1);
}

const destino = process.argv[3] || inv.client_email_sri || inv.billing_snapshot?.email;
if (!destino) { console.error('✖ No hay a quién enviarla: pasa el correo como segundo argumento.'); process.exit(1); }

const pdf = inv.pdf_data ? (Buffer.isBuffer(inv.pdf_data) ? inv.pdf_data : Buffer.from(inv.pdf_data)) : null;
const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org';

console.log(`factura ${inv.invoice_number} · ${inv.sri_status} · $${inv.total}`);
console.log(`pdf: ${pdf ? pdf.length + ' bytes' : '⚠️ SIN PDF ADJUNTO'}`);
console.log(`→ ${destino}`);

await sendPaidInvoiceEmail({
  email: destino,
  projectTitle: inv.project_title || 'Proyecto',
  stageName: inv.stage_name || 'Etapa',
  invoiceNumber: inv.invoice_number,
  authorization: inv.authorization_number,
  total: Number(inv.total),
  pdf,
  projectUrl: inv.project_id ? `${base}/proyecto/${inv.project_id}` : null,
});

console.log('✔ enviada');
await pool.end();
