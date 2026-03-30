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
  formaPago?: string;
  items: { description: string; quantity: number; unitPrice: number; subtotal: number; ivaRate: number; discount?: number }[];
  subtotal0: number;
  subtotalIva: number;
  ivaMonto: number;
  total: number;
  currency?: string;
  currencySymbol?: string;
  exchangeRate?: number;
  totalConverted?: number;
}

const FORMAS_PAGO_LABEL: Record<string, string> = {
  '01': 'SIN UTILIZACION DEL SISTEMA FINANCIERO', '15': 'COMPENSACION DE DEUDAS',
  '16': 'TARJETA DE DEBITO', '17': 'DINERO ELECTRONICO', '18': 'TARJETA PREPAGO',
  '19': 'TARJETA DE CREDITO', '20': 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO', '21': 'ENDOSO DE TITULOS',
};

function fmtDate(d: string): string {
  try { const dt = new Date(d); return `${dt.getFullYear()}-${(dt.getMonth()+1).toString().padStart(2,'0')}-${dt.getDate().toString().padStart(2,'0')} ${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}:${dt.getSeconds().toString().padStart(2,'0')}`; }
  catch { return d; }
}

export async function generateRidePdf(data: RideData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = doc.page.width - 60; // page usable width
    const L = 30; // left margin
    const midX = L + PW * 0.48;
    const rightColX = L + PW * 0.50;
    const rightColW = PW * 0.50;
    let y = 30;

    // ════════════ TOP SECTION: 2 columns ════════════

    // ─── LEFT: Emisor info ───
    const topY = y;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('black').text(SRI_CONFIG.razonSocial, L, y, { width: PW * 0.46 });
    y = doc.y + 2;
    doc.fontSize(8).font('Helvetica-Bold').text(SRI_CONFIG.nombreComercial, L, y, { width: PW * 0.46 });
    y = doc.y + 6;
    doc.fontSize(7).font('Helvetica-Bold').text('Dir. Matriz:', L, y, { continued: true }).font('Helvetica').text(`   ${SRI_CONFIG.dirMatriz}`, { width: PW * 0.44 });
    y = doc.y + 3;
    doc.font('Helvetica-Bold').text('Dir. Sucursal:', L, y, { continued: true }).font('Helvetica').text(`   ${SRI_CONFIG.dirEstablecimiento}`, { width: PW * 0.44 });
    y = doc.y + 3;
    doc.font('Helvetica-Bold').text(`Obligado A Llevar Contabilidad: `, L, y, { continued: true }).font('Helvetica').text(SRI_CONFIG.obligadoContabilidad);
    y = doc.y + 3;
    doc.font('Helvetica').text('Contribuyente Regimen General', L, y);
    const leftBottomY = doc.y + 4;

    // ─── RIGHT: Fiscal box ───
    let ry = topY;
    doc.rect(rightColX, ry, rightColW, 0).stroke('#000'); // will draw after content
    const boxStartY = ry;

    doc.fontSize(7).font('Helvetica-Bold').fillColor('black');
    doc.text('R.U.C:', rightColX + 8, ry + 6, { continued: true }).font('Helvetica-Bold').text(`  ${SRI_CONFIG.ruc}`);
    ry += 18;
    doc.fontSize(11).font('Helvetica-Bold').text('FACTURA', rightColX + 8, ry);
    ry += 16;
    doc.fontSize(7).font('Helvetica-Bold').text('No.', rightColX + 8, ry, { continued: true }).font('Helvetica').text(`  ${data.numeroFactura}`);
    ry += 12;
    doc.font('Helvetica-Bold').text('NUMERO AUTORIZACION', rightColX + 8, ry);
    ry += 10;
    doc.font('Courier').fontSize(5.5).text(data.numeroAutorizacion, rightColX + 8, ry, { width: rightColW - 16 });
    ry = doc.y + 6;

    doc.fontSize(7).font('Helvetica-Bold').text('FECHA Y HORA DE', rightColX + 8, ry); ry += 8;
    doc.text('AUTORIZACION', rightColX + 8, ry, { continued: true }).font('Helvetica').text(`     ${fmtDate(data.fechaAutorizacion)}`);
    ry += 12;
    doc.font('Helvetica-Bold').text('AMBIENTE:', rightColX + 8, ry, { continued: true }).font('Helvetica').text(`     ${SRI_CONFIG.ambiente === '2' ? 'Produccion' : 'Pruebas'}`);
    ry += 10;
    doc.font('Helvetica-Bold').text('EMISION:', rightColX + 8, ry, { continued: true }).font('Helvetica').text('     Normal');
    ry += 14;

    doc.fontSize(8).font('Helvetica-Bold').text('CLAVE DE ACCESO', rightColX + 8, ry, { width: rightColW - 16, align: 'center' });
    ry += 12;
    doc.font('Courier').fontSize(5.5).text(data.claveAcceso, rightColX + 8, ry, { width: rightColW - 16, align: 'center' });
    ry += 12;

    // Draw the box
    const boxH = ry - boxStartY + 4;
    doc.rect(rightColX, boxStartY, rightColW, boxH).stroke('#000');

    y = Math.max(leftBottomY, boxStartY + boxH) + 10;

    // ════════════ CLIENT SECTION ════════════
    doc.fontSize(7).font('Helvetica-Bold').fillColor('black');
    doc.text('Razon Social / Nombres y Apellidos: ', L, y, { continued: true }).font('Helvetica').text(data.clienteNombre);
    const clientRightX = L + PW * 0.65;
    doc.font('Helvetica-Bold').text('RUC / CI: ', clientRightX, y, { continued: true }).font('Helvetica').text(data.clienteRuc);
    y = doc.y + 3;
    doc.font('Helvetica-Bold').text('Fecha Emision: ', L, y, { continued: true }).font('Helvetica').text(data.fechaEmision);
    doc.font('Helvetica-Bold').text('Guia de Remision:', clientRightX, y);
    y = doc.y + 8;

    // ════════════ DETAIL TABLE ════════════
    const tCols = [
      { h: 'Cod.\nPrincipal', w: PW * 0.09, a: 'left' as const },
      { h: 'Cant.', w: PW * 0.07, a: 'center' as const },
      { h: 'Descripcion', w: PW * 0.32, a: 'left' as const },
      { h: 'Precio\nUnitario', w: PW * 0.11, a: 'right' as const },
      { h: 'Descuento', w: PW * 0.10, a: 'right' as const },
      { h: 'Precio Total', w: PW * 0.11, a: 'right' as const },
    ];

    // Header
    doc.rect(L, y, PW, 18).fill('#e8e8e8');
    doc.fillColor('black').font('Helvetica-Bold').fontSize(6);
    let hx = L;
    tCols.forEach(col => {
      doc.text(col.h, hx + 3, y + 3, { width: col.w - 6, align: col.a });
      hx += col.w;
    });
    y += 18;

    // Rows
    doc.font('Helvetica').fontSize(6.5).fillColor('black');
    data.items.forEach((item, idx) => {
      const descW = tCols[2].w - 6;
      const descH = doc.heightOfString(item.description, { width: descW });
      const rowH = Math.max(14, descH + 6);

      // Alternating bg
      if (idx % 2 === 0) { doc.rect(L, y, PW, rowH).fill('#f9f9f9'); doc.fillColor('black'); }

      let rx = L;
      const code = `SRV${String(idx + 1).padStart(3, '0')}`;
      const discount = item.discount || 0;

      doc.text(code, rx + 3, y + 3, { width: tCols[0].w - 6, align: tCols[0].a }); rx += tCols[0].w;
      doc.text(item.quantity.toFixed(0), rx + 3, y + 3, { width: tCols[1].w - 6, align: tCols[1].a }); rx += tCols[1].w;
      doc.text(item.description, rx + 3, y + 3, { width: descW }); rx += tCols[2].w;
      doc.text(`$${item.unitPrice.toFixed(4)}`, rx + 3, y + 3, { width: tCols[3].w - 6, align: tCols[3].a }); rx += tCols[3].w;
      doc.text(`$${discount.toFixed(2)}`, rx + 3, y + 3, { width: tCols[4].w - 6, align: tCols[4].a }); rx += tCols[4].w;
      doc.text(`$${item.subtotal.toFixed(2)}`, rx + 3, y + 3, { width: tCols[5].w - 6, align: tCols[5].a });
      y += rowH;
    });

    // Line under table
    doc.moveTo(L, y).lineTo(L + PW, y).stroke('#ccc');
    y += 8;

    // ════════════ BOTTOM: 2 columns (Pago+Info left, Totals right) ════════════
    const botLeftW = PW * 0.48;
    const botRightX = L + PW * 0.52;
    const botRightW = PW * 0.48;
    const botY = y;

    // ─── LEFT: Forma de Pago ───
    doc.rect(L, y, botLeftW, 12).fill('#e8e8e8');
    doc.fillColor('black').font('Helvetica-Bold').fontSize(6);
    doc.text('Forma de Pago', L + 3, y + 3, { width: botLeftW * 0.55 });
    doc.text('Valor', L + botLeftW * 0.55, y + 3, { width: botLeftW * 0.2, align: 'right' });
    doc.text('Plazo', L + botLeftW * 0.75, y + 3, { width: botLeftW * 0.12, align: 'right' });
    doc.text('Tiempo', L + botLeftW * 0.87, y + 3, { width: botLeftW * 0.12, align: 'right' });
    y += 12;

    const fpLabel = FORMAS_PAGO_LABEL[data.formaPago || '20'] || 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO';
    doc.font('Helvetica').fontSize(6);
    doc.text(fpLabel, L + 3, y + 2, { width: botLeftW * 0.55 });
    doc.text(`$${data.total.toFixed(2)}`, L + botLeftW * 0.55, y + 2, { width: botLeftW * 0.2, align: 'right' });
    doc.text('0', L + botLeftW * 0.75, y + 2, { width: botLeftW * 0.12, align: 'right' });
    doc.text('dias', L + botLeftW * 0.87, y + 2, { width: botLeftW * 0.12, align: 'right' });
    y += 14;

    // Info Adicional
    doc.rect(L, y, botLeftW, 12).fill('#e8e8e8');
    doc.fillColor('black').font('Helvetica-Bold').fontSize(6).text('Informacion Adicional', L + 3, y + 3);
    y += 12;
    doc.font('Helvetica').fontSize(6);
    if (data.clienteDireccion) { doc.font('Helvetica-Bold').text('DIRECCION', L + 3, y + 2, { continued: true }).font('Helvetica').text(`     ${data.clienteDireccion}`); y = doc.y + 2; }
    if (data.clienteTelefono) { doc.font('Helvetica-Bold').text('TELEFONO', L + 3, y + 2, { continued: true }).font('Helvetica').text(`     ${data.clienteTelefono}`); y = doc.y + 2; }
    if (data.clienteEmail) { doc.font('Helvetica-Bold').text('EMAIL', L + 3, y + 2, { continued: true }).font('Helvetica').text(`     ${data.clienteEmail}`); y = doc.y + 2; }
    doc.rect(L, botY + 12, botLeftW, y - botY - 12).stroke('#ccc');

    // ─── RIGHT: Totals ───
    let ty = botY;
    const totalDiscount = data.items.reduce((s, i) => s + (i.discount || 0), 0);
    const totals: [string, string][] = [
      ['SUBTOTAL 15%', `$  ${data.subtotalIva.toFixed(2)}`],
      ['SUBTOTAL 0%', `$  ${data.subtotal0.toFixed(2)}`],
      ['SUBTOTAL NO SUJETO IVA', '$  0.00'],
      ['SUBTOTAL EXENTO IVA', '$  0.00'],
      ['SUBTOTAL SIN IMPUESTOS', `$  ${(data.subtotal0 + data.subtotalIva).toFixed(2)}`],
      ['DESCUENTO', `$  ${totalDiscount.toFixed(2)}`],
      ['ICE', '$  0.00'],
      [`IVA 15%`, `$  ${data.ivaMonto.toFixed(2)}`],
      ['PROPINA', '$  0.00'],
      ['VALOR TOTAL', `$  ${data.total.toFixed(2)}`],
    ];

    totals.forEach(([label, val], i) => {
      const isLast = i === totals.length - 1;
      const rh = 12;
      if (isLast) {
        doc.rect(botRightX, ty, botRightW, rh + 4).fill('#e8e8e8');
        doc.fillColor('black');
      }
      doc.font(isLast ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5).fillColor('black');
      doc.text(label, botRightX + 4, ty + 3, { width: botRightW * 0.65 - 8 });
      doc.text(val, botRightX + botRightW * 0.65, ty + 3, { width: botRightW * 0.35 - 8, align: 'right' });
      ty += rh;
    });

    // Outer border for totals
    doc.rect(botRightX, botY, botRightW, ty - botY).stroke('#ccc');

    // ════════════ CURRENCY CONVERSION NOTE ════════════
    if (data.currency && data.currency !== 'USD' && data.exchangeRate && data.totalConverted) {
      const convY = Math.max(y, ty) + 12;
      const sym = data.currencySymbol || data.currency;
      doc.rect(L, convY, PW, 22).fill('#f0e6ff');
      doc.fillColor('#4B2D8E').font('Helvetica-Bold').fontSize(7);
      doc.text(`EQUIVALENTE EN ${data.currency}:  ${sym} ${data.totalConverted.toFixed(2)}`, L + 8, convY + 4, { width: PW - 16 });
      doc.font('Helvetica').fontSize(6).fillColor('#666');
      doc.text(`Tasa de cambio: 1 USD = ${data.exchangeRate} ${data.currency}`, L + 8, convY + 13, { width: PW - 16 });
    }

    // ════════════ FOOTER ════════════
    const pageBottom = doc.page.height - 40;
    doc.fontSize(6).font('Helvetica').fillColor('#999');
    doc.text('Pagina 1 de 1', L, pageBottom, { width: PW, align: 'right' });

    doc.end();
  });
}
