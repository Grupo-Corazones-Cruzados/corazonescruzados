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

export async function generateRidePdf(data: RideData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 80;
    const L = 40;
    const purple = '#4B2D8E';
    let y = 40;

    // ─── Emisor (left side) ───
    const leftW = W * 0.55;
    const rightW = W * 0.42;
    const rightX = L + W - rightW;

    doc.fontSize(11).font('Helvetica-Bold').text(SRI_CONFIG.razonSocial, L, y, { width: leftW });
    y = doc.y + 4;

    doc.fontSize(7).font('Helvetica').fillColor('#333');
    doc.text(`RUC: ${SRI_CONFIG.ruc}`, L, y); y += 10;
    doc.text(`Obligado Contabilidad: ${SRI_CONFIG.obligadoContabilidad}`, L, y); y += 10;
    doc.text(`Dir. Matriz: ${SRI_CONFIG.dirMatriz}`, L, y, { width: leftW }); y = doc.y + 4;
    doc.text(`Dir. Establecimiento: ${SRI_CONFIG.dirEstablecimiento}`, L, y, { width: leftW }); y = doc.y + 4;

    // ─── Invoice info box (right side) ───
    const boxY = 40;
    const boxH = y - boxY + 5;
    doc.rect(rightX, boxY, rightW, boxH).stroke(purple);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(purple).text('FACTURA', rightX, boxY + 8, { width: rightW, align: 'center' });
    doc.fontSize(8).fillColor('#333').font('Helvetica-Bold').text(`No. ${data.numeroFactura}`, rightX, boxY + 22, { width: rightW, align: 'center' });
    doc.font('Helvetica').fontSize(7).fillColor('#555');
    let ry = boxY + 36;
    doc.text(`Ambiente: ${SRI_CONFIG.ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS'}`, rightX + 8, ry); ry += 10;
    doc.text(`Emisión: NORMAL`, rightX + 8, ry); ry += 10;
    doc.text(`Fecha: ${data.fechaEmision}`, rightX + 8, ry); ry += 12;
    doc.fontSize(6).fillColor('#666');
    doc.text('CLAVE DE ACCESO:', rightX + 8, ry); ry += 8;
    doc.font('Courier').fontSize(5.5).text(data.claveAcceso, rightX + 8, ry, { width: rightW - 16 });

    y += 10;

    // ─── Autorización ───
    if (data.numeroAutorizacion) {
      doc.font('Helvetica').fontSize(7).fillColor('#333');
      doc.text(`No. AUTORIZACIÓN:    ${data.numeroAutorizacion}`, L, y, { width: W }); y += 10;
      doc.text(`Fecha Autorización: ${data.fechaAutorizacion}`, L, y); y += 14;
    } else {
      y += 10;
    }

    // ─── Cliente box ───
    doc.rect(L, y, W, 55).stroke('#ccc');
    const cy = y + 6;
    doc.fontSize(7).font('Helvetica').fillColor('#333');
    doc.text(`Razón Social / Nombres: ${data.clienteNombre}`, L + 8, cy, { width: W - 16 });
    doc.text(`RUC / CI: ${data.clienteRuc}`, L + 8, cy + 12);
    doc.text(`Teléfono: ${data.clienteTelefono}`, L + W / 2, cy + 12);
    doc.text(`Dirección: ${data.clienteDireccion}`, L + 8, cy + 24, { width: W - 16 });
    doc.text(`Email: ${data.clienteEmail}`, L + 8, cy + 36);
    y += 62;

    // ─── Items table ───
    const cols = [
      { header: '#', width: W * 0.05, align: 'center' as const },
      { header: 'Descripción', width: W * 0.40, align: 'left' as const },
      { header: 'Cant.', width: W * 0.10, align: 'right' as const },
      { header: 'P. Unit.', width: W * 0.14, align: 'right' as const },
      { header: 'IVA %', width: W * 0.10, align: 'right' as const },
      { header: 'Subtotal', width: W * 0.14, align: 'right' as const },
    ];

    // Header
    doc.rect(L, y, W, 16).fill(purple);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(7);
    let hx = L;
    cols.forEach(col => {
      doc.text(col.header, hx + 4, y + 4, { width: col.width - 8, align: col.align });
      hx += col.width;
    });
    y += 16;

    // Rows
    doc.font('Helvetica').fontSize(7).fillColor('#333');
    data.items.forEach((item, idx) => {
      const rowH = 14;
      if (idx % 2 === 1) { doc.rect(L, y, W, rowH).fill('#f8f8f8'); doc.fillColor('#333'); }
      let rx = L;
      const vals = [
        String(idx + 1),
        item.description.length > 55 ? item.description.substring(0, 55) + '...' : item.description,
        item.quantity.toFixed(2),
        item.unitPrice.toFixed(2),
        `${item.ivaRate}%`,
        item.subtotal.toFixed(2),
      ];
      vals.forEach((v, i) => {
        doc.text(v, rx + 4, y + 3, { width: cols[i].width - 8, align: cols[i].align });
        rx += cols[i].width;
      });
      y += rowH;
    });

    y += 12;

    // ─── Totals ───
    const totX = L + W * 0.56;
    const totW = W * 0.44;
    const totals = [
      ['SUBTOTAL 0%', data.subtotal0.toFixed(2)],
      ['SUBTOTAL IVA', data.subtotalIva.toFixed(2)],
      ['IVA', data.ivaMonto.toFixed(2)],
      ['TOTAL', data.total.toFixed(2)],
    ];
    totals.forEach(([label, val], i) => {
      const isLast = i === totals.length - 1;
      if (isLast) {
        doc.rect(totX, y, totW, 16).fill(purple);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(8);
      } else {
        doc.fillColor('#333').font('Helvetica').fontSize(7);
      }
      doc.text(label, totX + 8, y + (isLast ? 4 : 3), { width: totW / 2 - 12 });
      doc.text(val, totX + totW / 2, y + (isLast ? 4 : 3), { width: totW / 2 - 8, align: 'right' });
      y += isLast ? 16 : 14;
    });

    // ─── Footer ───
    doc.fillColor('#999').font('Helvetica').fontSize(6);
    doc.text('Documento generado electrónicamente — GCC World', L, y + 20, { width: W, align: 'center' });

    doc.end();
  });
}
