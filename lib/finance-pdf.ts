import PDFDocument from 'pdfkit/js/pdfkit.standalone';

interface FinanceMonthData {
  year: number;
  month: number;
  monthName: string;
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
  incomeItems: { description: string; amount: number }[];
  expenseItems: { description: string; amount: number }[];
}

export async function generateFinancePdf(months: FinanceMonthData[], title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = doc.page.width - 80;
    const L = 40;

    // Header
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a1a2e').text('GCC WORLD', L, 40, { width: PW });
    doc.fontSize(12).font('Helvetica-Bold').text(title, L, 60, { width: PW });
    doc.fontSize(8).font('Helvetica').fillColor('#666').text(`Generado: ${new Date().toLocaleDateString('es-EC')}`, L, 76, { width: PW });
    doc.moveTo(L, 90).lineTo(L + PW, 90).stroke('#ccc');
    let y = 100;

    // Global totals (if multiple months)
    if (months.length > 1) {
      const gIncome = months.reduce((s, m) => s + m.totalIncome, 0);
      const gExpense = months.reduce((s, m) => s + m.totalExpense, 0);
      const gSavings = months.reduce((s, m) => s + m.totalSavings, 0);

      doc.rect(L, y, PW, 14).fill('#e8e8e8');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(8);
      doc.text('RESUMEN GLOBAL', L + 4, y + 3, { width: PW * 0.4 });
      doc.text(`Ingresos: $${gIncome.toFixed(2)}`, L + PW * 0.3, y + 3, { width: PW * 0.23, align: 'right' });
      doc.text(`Egresos: $${gExpense.toFixed(2)}`, L + PW * 0.53, y + 3, { width: PW * 0.23, align: 'right' });
      doc.text(`Ahorro: $${gSavings.toFixed(2)}`, L + PW * 0.76, y + 3, { width: PW * 0.23, align: 'right' });
      doc.rect(L, y, PW, 14).stroke('#ccc');
      y += 24;
    }

    // Each month
    for (let mi = 0; mi < months.length; mi++) {
      const m = months[mi];

      // Check if we need a new page
      if (y > doc.page.height - 200) {
        doc.addPage();
        y = 40;
      }

      // Month header
      doc.rect(L, y, PW, 16).fill('#1a1a2e');
      doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
      doc.text(`${m.monthName} ${m.year}`, L + 6, y + 4, { width: PW - 12 });
      y += 20;

      const colW = (PW - 10) / 2;

      // Income section
      const incomeStartY = y;
      doc.fillColor('#1a7a1a').font('Helvetica-Bold').fontSize(8).text('INGRESOS', L, y + 2);
      y += 14;

      doc.font('Helvetica').fontSize(7).fillColor('#333');
      for (const item of m.incomeItems) {
        if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
        doc.text(item.description, L + 4, y, { width: colW - 50 });
        doc.text(`$${item.amount.toFixed(2)}`, L + colW - 50, y, { width: 46, align: 'right' });
        y += 11;
      }
      // Income total
      doc.moveTo(L, y).lineTo(L + colW, y).stroke('#ccc');
      y += 3;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1a7a1a');
      doc.text('Total Ingresos:', L + 4, y);
      doc.text(`$${m.totalIncome.toFixed(2)}`, L + colW - 50, y, { width: 46, align: 'right' });
      y += 14;

      // Expense section
      doc.fillColor('#cc0000').font('Helvetica-Bold').fontSize(8).text('EGRESOS', L, y + 2);
      y += 14;

      doc.font('Helvetica').fontSize(7).fillColor('#333');
      for (const item of m.expenseItems) {
        if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
        doc.text(item.description, L + 4, y, { width: colW - 50 });
        doc.text(`$${item.amount.toFixed(2)}`, L + colW - 50, y, { width: 46, align: 'right' });
        y += 11;
      }
      // Expense total
      doc.moveTo(L, y).lineTo(L + colW, y).stroke('#ccc');
      y += 3;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#cc0000');
      doc.text('Total Egresos:', L + 4, y);
      doc.text(`$${m.totalExpense.toFixed(2)}`, L + colW - 50, y, { width: 46, align: 'right' });
      y += 14;

      // Savings
      const savColor = m.totalSavings >= 0 ? '#1a1a7a' : '#cc0000';
      doc.rect(L, y, PW, 14).fill('#e8e8e8');
      doc.fillColor(savColor).font('Helvetica-Bold').fontSize(8);
      doc.text('AHORRO:', L + 4, y + 3, { width: PW * 0.6 });
      doc.text(`$${m.totalSavings.toFixed(2)}`, L + PW * 0.6, y + 3, { width: PW * 0.38, align: 'right' });
      doc.rect(L, y, PW, 14).stroke('#ccc');
      y += 24;

      // Separator between months
      if (mi < months.length - 1) {
        doc.moveTo(L, y).lineTo(L + PW, y).dash(3, { space: 3 }).stroke('#ccc');
        doc.undash();
        y += 12;
      }
    }

    // Footer
    const pageBottom = doc.page.height - 30;
    doc.fontSize(6).font('Helvetica').fillColor('#999');
    doc.text('Reporte generado por GCC World', L, pageBottom, { width: PW, align: 'center' });

    doc.end();
  });
}
