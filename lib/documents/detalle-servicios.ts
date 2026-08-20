import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import { SRI_CONFIG } from '@/lib/integrations/sri/config';

/**
 * DETALLE DE SERVICIOS — documento INFORMATIVO que acompaña a una factura.
 *
 * Lo piden algunos clientes para tener en un papel todos los conceptos de la operación,
 * incluidos los que **no** pasan por la factura (transferencias internacionales, remesas
 * al exterior…). Se descarga desde el detalle de la factura y se envía a mano.
 *
 * ⚠️ NO ES UN COMPROBANTE DE VENTA. Lo que lo mantiene a distancia de una factura es el
 * título —«DETALLE DE SERVICIOS», nunca «factura»— y que el número de la factura sale como
 * REFERENCIA, junto a su autorización, no como número propio.
 *
 * **Llevaba además una leyenda al pie** («documento informativo, sin validez tributaria…»)
 * y **Fernando pidió quitarla el 2026-08-20**. Queda anotado por si hay que reponerla: el
 * texto está en el historial de git, en este mismo archivo.
 *
 * Las dos tablas van separadas a propósito (decisión de Fernando, 2026-08-20): lo
 * facturado con su total, los adicionales con el suyo, y un total general debajo. Así el
 * cliente cuadra sus números sin que se confunda lo que pasó por el SRI con lo que no.
 */

export interface DetalleItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface DetalleServiciosData {
  numeroFactura: string;
  fechaEmision: string;
  numeroAutorizacion?: string | null;
  clienteNombre: string;
  clienteRuc: string;
  clienteDireccion?: string;
  clienteEmail?: string;
  /** Ítems tal como se facturaron (importes ya netos de descuento). */
  facturados: { description: string; quantity: number; unitPrice: number; subtotal: number }[];
  /** Conceptos que NO están en la factura. */
  adicionales: DetalleItem[];
  notas?: string;
}

/** Importe con separador de miles y coma decimal, como el resto de la interfaz. */
function money(n: number): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

export async function generateDetalleServiciosPdf(data: DetalleServiciosData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 36, bottom: 36, left: 36, right: 36 } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L = 36;
    const PW = doc.page.width - 72;
    let y = 36;

    // ══════════ Emisor (izquierda) + identificación del documento (derecha) ══════════
    const colDerX = L + PW * 0.56;
    const colDerW = PW * 0.44;

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1c1b22')
      .text(SRI_CONFIG.razonSocial, L, y, { width: PW * 0.52 });
    y = doc.y + 1;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4b2d8e')
      .text(SRI_CONFIG.nombreComercial, L, y, { width: PW * 0.52 });
    y = doc.y + 6;
    doc.fontSize(8).font('Helvetica').fillColor('#56545f');
    doc.text(`RUC: ${SRI_CONFIG.ruc}`, L, y, { width: PW * 0.52 }); y = doc.y + 2;
    doc.text(SRI_CONFIG.dirMatriz, L, y, { width: PW * 0.52 }); y = doc.y + 2;
    doc.text(SRI_CONFIG.contribuyenteRimpe, L, y, { width: PW * 0.52 });
    const finIzq = doc.y;

    // Recuadro del documento
    let ry = 36;
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1c1b22')
      .text('DETALLE DE SERVICIOS', colDerX + 10, ry + 8, { width: colDerW - 20 });
    ry = doc.y + 6;
    doc.fontSize(8).font('Helvetica').fillColor('#56545f');
    doc.font('Helvetica-Bold').text('Ref. factura:', colDerX + 10, ry, { continued: true })
      .font('Helvetica').text(`  ${data.numeroFactura}`);
    ry = doc.y + 3;
    doc.font('Helvetica-Bold').text('Fecha:', colDerX + 10, ry, { continued: true })
      .font('Helvetica').text(`  ${data.fechaEmision}`);
    ry = doc.y + 3;
    if (data.numeroAutorizacion) {
      doc.font('Helvetica-Bold').text('Autorización SRI:', colDerX + 10, ry, { width: colDerW - 20 });
      ry = doc.y + 1;
      doc.font('Courier').fontSize(6).fillColor('#86838f')
        .text(data.numeroAutorizacion, colDerX + 10, ry, { width: colDerW - 20 });
      ry = doc.y + 3;
    }
    doc.rect(colDerX, 36, colDerW, Math.max(ry - 36 + 6, 56)).stroke('#cfc9de');

    y = Math.max(finIzq, ry + 6) + 16;

    // ══════════ Cliente ══════════
    doc.rect(L, y, PW, 18).fill('#f2f0f7');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1c1b22').text('CLIENTE', L + 8, y + 5.5);
    y += 24;
    doc.fontSize(8.5).font('Helvetica').fillColor('#1c1b22');
    doc.font('Helvetica-Bold').text('Razón social:', L + 2, y, { continued: true })
      .font('Helvetica').text(`  ${data.clienteNombre}`, { width: PW - 4 });
    y = doc.y + 3;
    doc.font('Helvetica-Bold').text('Identificación:', L + 2, y, { continued: true })
      .font('Helvetica').text(`  ${data.clienteRuc || '—'}`);
    y = doc.y + 3;
    if (data.clienteDireccion) {
      doc.font('Helvetica-Bold').text('Dirección:', L + 2, y, { continued: true })
        .font('Helvetica').text(`  ${data.clienteDireccion}`, { width: PW - 4 });
      y = doc.y + 3;
    }
    if (data.clienteEmail) {
      doc.font('Helvetica-Bold').text('Correo:', L + 2, y, { continued: true })
        .font('Helvetica').text(`  ${data.clienteEmail}`);
      y = doc.y + 3;
    }
    y += 12;

    // ══════════ Tabla reutilizable ══════════
    const cols = [
      { h: 'Cant.', w: PW * 0.09, a: 'center' as const },
      { h: 'Descripción', w: PW * 0.55, a: 'left' as const },
      { h: 'P. unitario', w: PW * 0.18, a: 'right' as const },
      { h: 'Total', w: PW * 0.18, a: 'right' as const },
    ];

    const tabla = (titulo: string, filas: { description: string; quantity: number; unitPrice: number; subtotal: number }[], etiquetaTotal: string) => {
      doc.rect(L, y, PW, 18).fill('#f2f0f7');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#1c1b22').text(titulo, L + 8, y + 5.5, { width: PW - 16 });
      y += 18;

      // Cabecera de columnas
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#86838f');
      let hx = L;
      cols.forEach(c => { doc.text(c.h, hx + 4, y + 4, { width: c.w - 8, align: c.a }); hx += c.w; });
      y += 15;
      doc.moveTo(L, y).lineTo(L + PW, y).stroke('#e6e3ee');
      y += 4;

      doc.fontSize(8.5).font('Helvetica').fillColor('#1c1b22');
      filas.forEach(it => {
        const descW = cols[1].w - 8;
        const alto = Math.max(14, doc.heightOfString(it.description, { width: descW }) + 6);
        let rx = L;
        doc.text(String(it.quantity), rx + 4, y + 3, { width: cols[0].w - 8, align: cols[0].a }); rx += cols[0].w;
        doc.text(it.description, rx + 4, y + 3, { width: descW }); rx += cols[1].w;
        doc.text(`$ ${money(it.unitPrice)}`, rx + 4, y + 3, { width: cols[2].w - 8, align: cols[2].a }); rx += cols[2].w;
        doc.text(`$ ${money(it.subtotal)}`, rx + 4, y + 3, { width: cols[3].w - 8, align: cols[3].a });
        y += alto;
        doc.moveTo(L, y).lineTo(L + PW, y).stroke('#f0eef6');
      });

      const total = filas.reduce((s, i) => s + i.subtotal, 0);
      y += 6;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#56545f')
        .text(etiquetaTotal, L + PW * 0.5, y, { width: PW * 0.32, align: 'right' });
      doc.fillColor('#1c1b22').text(`$ ${money(total)}`, L + PW * 0.82, y, { width: PW * 0.18 - 4, align: 'right' });
      y += 22;
      return total;
    };

    const totalFacturado = tabla('ÍTEMS FACTURADOS', data.facturados, 'Total facturado');

    const adicionales = data.adicionales.map(i => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: Math.round(i.quantity * i.unitPrice * 100) / 100,
    }));
    const totalAdicional = adicionales.length > 0
      ? tabla('CONCEPTOS ADICIONALES', adicionales, 'Total adicional')
      : 0;

    // ══════════ Total general ══════════
    const totalGeneral = Math.round((totalFacturado + totalAdicional) * 100) / 100;
    doc.rect(L + PW * 0.5, y, PW * 0.5, 24).fill('#4b2d8e');
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#ffffff')
      .text('TOTAL GENERAL', L + PW * 0.52, y + 7.5, { width: PW * 0.25 });
    doc.text(`$ ${money(totalGeneral)}`, L + PW * 0.75, y + 7.5, { width: PW * 0.23, align: 'right' });
    y += 34;

    // ══════════ Notas ══════════
    if (data.notas?.trim()) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#56545f').text('OBSERVACIONES', L, y);
      y = doc.y + 3;
      doc.fontSize(8.5).font('Helvetica').fillColor('#1c1b22').text(data.notas.trim(), L, y, { width: PW });
      y = doc.y + 14;
    }

    doc.end();
  });
}
