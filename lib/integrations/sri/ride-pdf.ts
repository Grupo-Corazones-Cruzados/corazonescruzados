import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import { SRI_CONFIG } from './config';

interface RideData {
  claveAcceso: string;
  numeroAutorizacion: string;
  fechaAutorizacion: string;
  numeroFactura: string;
  fechaEmision: string;
  clienteNombre: string;
  clienteRuc: string;
  clienteDireccion: string;
  clienteEmail: string;
  clienteTelefono: string;
  items: { description: string; quantity: number; unitPrice: number; subtotal: number; ivaRate: number }[];
  subtotal0: number;
  subtotalIva: number;
  ivaMonto: number;
  total: number;
}

/**
 * Genera el RIDE (PDF) de la factura
 * Returns a Buffer with the PDF content
 */
export async function generateRidePdf(data: RideData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const w = doc.page.width - 80; // usable width
    const col1 = 40; // left margin

    // ─── Header ───
    doc.fontSize(14).font('Helvetica-Bold').text(SRI_CONFIG.razonSocial, col1, 40, { width: w / 2 });
    doc.fontSize(8).font('Helvetica').text(`RUC: ${SRI_CONFIG.ruc}`, col1, 58);
    doc.text(SRI_CONFIG.regimenMicroempresas, col1, 68);
    doc.text(`Obligado Contabilidad: ${SRI_CONFIG.obligadoContabilidad}`, col1, 78);
    doc.text(`Dir. Matriz: ${SRI_CONFIG.dirMatriz}`, col1, 88);
    doc.text(`Dir. Establecimiento: ${SRI_CONFIG.dirEstablecimiento}`, col1, 98);

    // Right side — invoice info box
    const boxX = w / 2 + 60;
    const boxW = w / 2 - 20;
    doc.rect(boxX, 35, boxW, 85).stroke('#4B2D8E');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4B2D8E').text('FACTURA', boxX + 10, 42, { width: boxW - 20, align: 'center' });
    doc.fillColor('black').fontSize(8).font('Helvetica-Bold').text(`No. ${data.numeroFactura}`, boxX + 10, 56, { width: boxW - 20, align: 'center' });
    doc.font('Helvetica').fontSize(7);
    doc.text(`Ambiente: ${SRI_CONFIG.ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS'}`, boxX + 10, 72);
    doc.text(`Emisión: ${SRI_CONFIG.tipoEmision === '1' ? 'NORMAL' : 'CONTINGENCIA'}`, boxX + 10, 82);
    doc.text(`Fecha: ${data.fechaEmision}`, boxX + 10, 92);

    // Clave de acceso
    doc.fontSize(6).text('CLAVE DE ACCESO:', boxX + 10, 104);
    doc.fontSize(6).font('Courier').text(data.claveAcceso, boxX + 10, 112, { width: boxW - 20 });

    // Autorización
    let y = 130;
    if (data.numeroAutorizacion) {
      doc.font('Helvetica').fontSize(6).text('No. AUTORIZACIÓN:', col1, y);
      doc.font('Courier').fontSize(6).text(data.numeroAutorizacion, col1 + 80, y, { width: w - 80 });
      y += 10;
      doc.font('Helvetica').text(`Fecha Autorización: ${data.fechaAutorizacion}`, col1, y);
      y += 14;
    } else {
      y += 10;
    }

    // ─── Client info ───
    doc.rect(col1, y, w, 55).stroke();
    y += 5;
    doc.fontSize(7).font('Helvetica');
    doc.text(`Razón Social / Nombres: ${data.clienteNombre}`, col1 + 5, y);
    y += 12;
    doc.text(`RUC / CI: ${data.clienteRuc}`, col1 + 5, y);
    doc.text(`Teléfono: ${data.clienteTelefono}`, col1 + w / 2, y);
    y += 12;
    doc.text(`Dirección: ${data.clienteDireccion}`, col1 + 5, y);
    y += 12;
    doc.text(`Email: ${data.clienteEmail}`, col1 + 5, y);
    y += 20;

    // ─── Items table ───
    const colWidths = [w * 0.05, w * 0.45, w * 0.12, w * 0.13, w * 0.12, w * 0.13];
    const headers = ['#', 'Descripción', 'Cant.', 'P. Unit.', 'IVA %', 'Subtotal'];

    // Header row
    doc.rect(col1, y, w, 14).fill('#4B2D8E');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(7);
    let hx = col1 + 3;
    headers.forEach((h, i) => {
      doc.text(h, hx, y + 3, { width: colWidths[i] - 6, align: i > 1 ? 'right' : 'left' });
      hx += colWidths[i];
    });
    y += 14;

    // Items
    doc.fillColor('black').font('Helvetica').fontSize(7);
    data.items.forEach((item, idx) => {
      const rowH = 12;
      if (idx % 2 === 1) doc.rect(col1, y, w, rowH).fill('#f5f5f5');
      doc.fillColor('black');
      let ix = col1 + 3;
      const vals = [
        String(idx + 1),
        item.description,
        item.quantity.toFixed(2),
        item.unitPrice.toFixed(2),
        `${item.ivaRate}%`,
        item.subtotal.toFixed(2),
      ];
      vals.forEach((v, i) => {
        doc.text(v, ix, y + 2, { width: colWidths[i] - 6, align: i > 1 ? 'right' : 'left' });
        ix += colWidths[i];
      });
      y += rowH;
    });

    y += 10;

    // ─── Totals ───
    const totX = col1 + w * 0.6;
    const totW = w * 0.4;
    const totals = [
      ['SUBTOTAL 0%', data.subtotal0.toFixed(2)],
      ['SUBTOTAL IVA', data.subtotalIva.toFixed(2)],
      ['IVA', data.ivaMonto.toFixed(2)],
      ['TOTAL', data.total.toFixed(2)],
    ];

    totals.forEach(([label, val], i) => {
      const isLast = i === totals.length - 1;
      if (isLast) {
        doc.rect(totX, y, totW, 14).fill('#4B2D8E');
        doc.fillColor('white').font('Helvetica-Bold');
      } else {
        doc.fillColor('black').font('Helvetica');
      }
      doc.fontSize(7).text(label, totX + 5, y + 3, { width: totW / 2 - 10 });
      doc.text(val, totX + totW / 2, y + 3, { width: totW / 2 - 5, align: 'right' });
      y += 14;
    });

    doc.fillColor('black');
    y += 20;

    // ─── Footer ───
    doc.fontSize(6).font('Helvetica').fillColor('#666');
    doc.text('Documento generado electrónicamente — GCC World', col1, y, { width: w, align: 'center' });

    doc.end();
  });
}
