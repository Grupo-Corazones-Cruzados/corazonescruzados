import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import fs from 'fs';
import path from 'path';
import { fmt2 } from '@/lib/format';

interface FinanceMonthData {
  year: number;
  month: number;
  monthName: string;
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
  incomeItems: { description: string; amount: number }[];
  expenseItems: { description: string; amount: number }[];
  // Ahorro acumulado de todos los meses ANTERIORES a este. Si está
  // definido, el PDF agrega los indicadores "a la fecha" y "global".
  priorSavings?: number;
}

/**
 * EL REPORTE FINANCIERO EN PDF — rediseñado el 2026-10-29 (Fernando: «un estilo más moderno y
 * profesional, reformúlalo como quieras»). Lo usan el reporte de varios meses (`/api/finance/pdf`,
 * con los filtros del Inicio) y el de un mes (`/api/finance/[id]/pdf`).
 *
 * Estructura:
 *   1. Cabecera de marca: banda violeta con degradado, logo, título, lo filtrado, periodo y fecha.
 *   2. Tres indicadores (ingresos, egresos, ahorro) con su promedio mensual y la tasa de ahorro.
 *   3. Con varios meses: gráfico de barras ingresos/egresos y tabla resumen con el margen.
 *   4. El detalle de cada mes: ingresos y egresos en listas a todo el ancho y el ahorro en una
 *      franja (con el acumulado en tres fichas en el PDF de un mes).
 *   5. Pie en todas las páginas con «Página X de Y».
 *
 * ⚠️ Dos trampas ya pagadas de PDFKit en este repo:
 *   · El logo va como `data:` URL: el build standalone no acepta un Buffer de Node en `image()`.
 *   · El pie se escribe SIN `width`/`align` y con el margen inferior a 0: por debajo del margen,
 *     un texto con `width` añade una página en blanco.
 *
 * Los importes van en formato es-ES (`$27.586,11`) como en la pantalla: es un informe interno
 * para leer, no un documento tributario (los del SRI sí exigen punto decimal).
 */

const C = {
  tinta: '#17122B',
  texto: '#2B2540',
  tenue: '#6B6585',
  suave: '#9A94AD',
  borde: '#E7E2F3',
  lavanda: '#F6F3FD',
  violeta: '#4B2D8E',
  violetaVivo: '#6D28D9',
  lila: '#C4B5FD',
  verde: '#0E700E',
  verdeBarra: '#22A35A',
  rojo: '#B3261E',
  rojoBarra: '#E2557A',
  ambar: '#9A6B00',
};

const M = 40; // margen
const money = (n: number) => `${n < 0 ? '-' : ''}$${fmt2(Math.abs(n))}`;
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function logoDataUrl(): string | null {
  try {
    const b = fs.readFileSync(path.join(process.cwd(), 'public', 'logo-gcc.png'));
    return `data:image/png;base64,${b.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function generateFinancePdf(
  months: FinanceMonthData[],
  title: string,
  opciones: { subtitulo?: string } = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', bufferPages: true, margins: { top: M, bottom: 56, left: M, right: M } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const PW = W - M * 2;
    const LIMITE = H - 64; // dónde deja de caber contenido (encima del pie)
    let y = 0;

    const nuevaPagina = () => { doc.addPage(); y = M; };
    const asegurar = (alto: number) => { if (y + alto > LIMITE) nuevaPagina(); };

    // Meses en orden cronológico para el gráfico; el resto del documento, del más reciente al más antiguo.
    const cronologico = [...months].sort((a, b) => a.year - b.year || a.month - b.month);
    const gIngresos = months.reduce((s, m) => s + m.totalIncome, 0);
    const gEgresos = months.reduce((s, m) => s + m.totalExpense, 0);
    const gAhorro = months.reduce((s, m) => s + m.totalSavings, 0);
    const n = Math.max(months.length, 1);
    const periodo = cronologico.length
      ? cronologico.length === 1
        ? `${cronologico[0].monthName} ${cronologico[0].year}`
        : `${MESES_CORTOS[cronologico[0].month - 1]} ${cronologico[0].year} – ${MESES_CORTOS[cronologico[cronologico.length - 1].month - 1]} ${cronologico[cronologico.length - 1].year}`
      : 'Sin meses';

    // ── 1. CABECERA ────────────────────────────────────────────────────────────────────
    const ALTO_CAB = 118;
    const grad = doc.linearGradient(0, 0, W, ALTO_CAB);
    grad.stop(0, '#17122B').stop(0.55, '#2A1D52').stop(1, '#4B2D8E');
    doc.rect(0, 0, W, ALTO_CAB).fill(grad);
    // Un toque de luz, como las manchas de la portada.
    doc.save().opacity(0.18).circle(W - 70, 8, 90).fill('#A21CAF').restore();
    doc.save().opacity(0.10).circle(W - 190, ALTO_CAB + 10, 70).fill('#C4B5FD').restore();

    const logo = logoDataUrl();
    if (logo) doc.image(logo, M, 30, { width: 30, height: 30 });
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.lila)
      .text('GRUPO CORAZONES CRUZADOS', M + (logo ? 40 : 0), 34, { characterSpacing: 2.2 });
    doc.font('Helvetica').fontSize(7.5).fillColor('#B9AEDB')
      .text('GCC World · Finanzas', M + (logo ? 40 : 0), 46, { characterSpacing: 0.4 });

    doc.font('Helvetica-Bold').fontSize(22).fillColor('#FFFFFF').text(title, M, 70, { width: PW * 0.62 });
    if (opciones.subtitulo) {
      doc.font('Helvetica').fontSize(9.5).fillColor(C.lila).text(opciones.subtitulo, M, 97, { width: PW * 0.62 });
    }

    // A la derecha: periodo y fecha de generación.
    const derecha = (etiqueta: string, valor: string, yy: number) => {
      doc.font('Helvetica').fontSize(6.8).fillColor('#B9AEDB').text(etiqueta.toUpperCase(), M + PW * 0.62, yy, { width: PW * 0.38, align: 'right', characterSpacing: 1.2 });
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#FFFFFF').text(valor, M + PW * 0.62, yy + 10, { width: PW * 0.38, align: 'right' });
    };
    derecha('Periodo', periodo, 66);
    derecha('Generado', new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' }), 92);
    y = ALTO_CAB + 22;

    // ── 2. INDICADORES ─────────────────────────────────────────────────────────────────
    const tasa = gIngresos > 0 ? (gAhorro / gIngresos) * 100 : 0;
    const tarjetas: { etiqueta: string; valor: number; color: string; nota: string }[] = [
      { etiqueta: 'Ingresos', valor: gIngresos, color: C.verdeBarra, nota: n > 1 ? `Promedio mensual ${money(gIngresos / n)}` : `${months[0]?.incomeItems.length ?? 0} conceptos` },
      { etiqueta: 'Egresos', valor: gEgresos, color: C.rojoBarra, nota: n > 1 ? `Promedio mensual ${money(gEgresos / n)}` : `${months[0]?.expenseItems.length ?? 0} conceptos` },
      { etiqueta: 'Ahorro', valor: gAhorro, color: C.violetaVivo, nota: `Tasa de ahorro ${fmt2(tasa)} %` },
    ];
    const GAP = 12;
    const TW = (PW - GAP * 2) / 3;
    const TH = 70;
    tarjetas.forEach((t, i) => {
      const x = M + i * (TW + GAP);
      doc.roundedRect(x, y, TW, TH, 8).fillAndStroke('#FFFFFF', C.borde);
      doc.save().roundedRect(x, y, 4, TH, 2).fill(t.color).restore();
      doc.font('Helvetica-Bold').fontSize(7).fillColor(C.tenue).text(t.etiqueta.toUpperCase(), x + 16, y + 13, { characterSpacing: 1.4 });
      const colorValor = t.etiqueta === 'Ahorro' && t.valor < 0 ? C.rojo : C.tinta;
      doc.font('Helvetica-Bold').fontSize(17).fillColor(colorValor).text(money(t.valor), x + 16, y + 26, { width: TW - 28 });
      doc.font('Helvetica').fontSize(7.5).fillColor(C.tenue).text(t.nota, x + 16, y + 50, { width: TW - 28 });
    });
    y += TH + 26;

    // ── 3a. GRÁFICO (varios meses) ─────────────────────────────────────────────────────
    const titulo = (texto: string, detalle?: string) => {
      asegurar(40);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(C.tinta).text(texto, M, y);
      if (detalle) {
        const w = doc.font('Helvetica').fontSize(8).widthOfString(detalle);
        doc.fillColor(C.suave).text(detalle, M + PW - w, y + 3);
      }
      y += 22;
    };

    if (cronologico.length > 1) {
      const serie = cronologico.slice(-12);
      titulo('Evolución mensual', serie.length < cronologico.length ? 'Últimos 12 meses' : undefined);
      const CH = 150;
      asegurar(CH + 46);
      y += 16; // la leyenda va en esta franja, bajo el título
      const top = y;
      const base = top + CH - 18;
      const maxV = Math.max(1, ...serie.map((m) => Math.max(m.totalIncome, m.totalExpense)));
      // Líneas guía: 0, 50 % y 100 % del máximo.
      [0, 0.5, 1].forEach((f) => {
        const yy = base - (CH - 34) * f;
        doc.moveTo(M + 44, yy).lineTo(M + PW, yy).lineWidth(0.5).strokeColor(f === 0 ? '#CFC8E4' : C.borde).stroke();
        const etiqueta = `$${fmt2(maxV * f).replace(/,00$/, '')}`;
        const w = doc.font('Helvetica').fontSize(6.5).widthOfString(etiqueta);
        doc.fillColor(C.suave).text(etiqueta, M + 38 - w, yy - 3);
      });
      const zona = PW - 50;
      const paso = zona / serie.length;
      const bw = Math.min(14, paso * 0.32);
      serie.forEach((m, i) => {
        const cx = M + 50 + paso * i + paso / 2;
        const hi = ((CH - 34) * m.totalIncome) / maxV;
        const he = ((CH - 34) * m.totalExpense) / maxV;
        if (hi > 0) doc.roundedRect(cx - bw - 1, base - hi, bw, hi, Math.min(2.5, hi / 2)).fill(C.verdeBarra);
        if (he > 0) doc.roundedRect(cx + 1, base - he, bw, he, Math.min(2.5, he / 2)).fill(C.rojoBarra);
        const et = `${MESES_CORTOS[m.month - 1]} ${String(m.year).slice(2)}`;
        const w = doc.font('Helvetica').fontSize(6.5).widthOfString(et);
        doc.fillColor(C.tenue).text(et, cx - w / 2, base + 5);
      });
      // Leyenda
      const ley = (x: number, color: string, texto: string) => {
        doc.roundedRect(x, top - 16, 8, 8, 2).fill(color);
        doc.font('Helvetica').fontSize(7.5).fillColor(C.tenue).text(texto, x + 12, top - 15.5);
      };
      ley(M, C.verdeBarra, 'Ingresos');
      ley(M + 62, C.rojoBarra, 'Egresos');
      y = top + CH + 18;

      // ── 3b. TABLA RESUMEN ──────────────────────────────────────────────────────────
      titulo('Resumen por mes', `${months.length} meses`);
      const cols = [
        { t: 'Mes', w: 0.28, a: 'left' as const },
        { t: 'Ingresos', w: 0.19, a: 'right' as const },
        { t: 'Egresos', w: 0.19, a: 'right' as const },
        { t: 'Ahorro', w: 0.19, a: 'right' as const },
        { t: 'Margen', w: 0.15, a: 'right' as const },
      ];
      const fila = (valores: string[], yy: number, opts: { negrita?: boolean; colores?: (string | undefined)[]; tam?: number } = {}) => {
        let x = M;
        cols.forEach((c, i) => {
          const w = PW * c.w;
          doc.font(opts.negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.tam ?? 8.5).fillColor(opts.colores?.[i] ?? C.texto)
            .text(valores[i], x + 10, yy, { width: w - 20, align: c.a, lineBreak: false });
          x += w;
        });
      };
      const cabecera = () => {
        doc.roundedRect(M, y, PW, 22, 5).fill(C.lavanda);
        let x = M;
        cols.forEach((c) => {
          const w = PW * c.w;
          doc.font('Helvetica-Bold').fontSize(6.8).fillColor(C.tenue).text(c.t.toUpperCase(), x + 10, y + 8, { width: w - 20, align: c.a, characterSpacing: 1 });
          x += w;
        });
        y += 26;
      };
      asegurar(60);
      cabecera();
      months.forEach((m, i) => {
        if (y + 20 > LIMITE) { nuevaPagina(); cabecera(); }
        if (i % 2 === 1) doc.rect(M, y - 4, PW, 20).fill('#FBFAFE');
        const margen = m.totalIncome > 0 ? `${fmt2((m.totalSavings / m.totalIncome) * 100)} %` : '—';
        fila(
          [`${m.monthName} ${m.year}`, money(m.totalIncome), money(m.totalExpense), money(m.totalSavings), margen],
          y + 2,
          { colores: [C.tinta, C.verde, C.rojo, m.totalSavings < 0 ? C.rojo : C.violeta, m.totalSavings < 0 ? C.rojo : C.tenue] },
        );
        y += 20;
      });
      asegurar(28);
      doc.moveTo(M, y).lineTo(M + PW, y).lineWidth(1).strokeColor(C.violeta).stroke();
      y += 7;
      fila(['Total', money(gIngresos), money(gEgresos), money(gAhorro), gIngresos > 0 ? `${fmt2(tasa)} %` : '—'], y, {
        negrita: true, tam: 9, colores: [C.tinta, C.verde, C.rojo, gAhorro < 0 ? C.rojo : C.violeta, C.tinta],
      });
      y += 30;
    }

    // ── 4. DETALLE DE CADA MES ─────────────────────────────────────────────────────────
    if (months.length > 1) {
      nuevaPagina();
      doc.font('Helvetica-Bold').fontSize(16).fillColor(C.tinta).text('Detalle por mes', M, y);
      y += 30;
    }

    // Cada mes: cabecera con sus tres cifras, ingresos y egresos en listas A TODO EL ANCHO (en
    // dos columnas las descripciones se partían y, sin egresos, media página quedaba vacía) y el
    // ahorro en una franja fina. Un mes PUEDE seguir en la página siguiente: obligar a que cupiera
    // entero dejaba dos meses por página (11 páginas para 20 meses).
    const ANCHO_DESC = PW - 120;
    const altoFila = (d: string) => Math.max(15, doc.font('Helvetica').fontSize(8.5).heightOfString(d || '—', { width: ANCHO_DESC }) + 6);

    const cabeceraMes = (m: FinanceMonthData, sigue = false) => {
      doc.roundedRect(M, y, PW, 30, 6).fill(C.lavanda);
      doc.save().roundedRect(M, y, 4, 30, 2).fill(C.violetaVivo).restore();
      doc.font('Helvetica-Bold').fontSize(12).fillColor(C.tinta).text(`${m.monthName} ${m.year}${sigue ? ' (continuación)' : ''}`, M + 16, y + 9);
      // Con un solo mes, sus cifras ya están en las tarjetas de arriba: no se repiten.
      if (!sigue && months.length > 1) {
        const resumen = [
          { t: 'Ingresos', v: money(m.totalIncome), c: C.verde },
          { t: 'Egresos', v: money(m.totalExpense), c: C.rojo },
          { t: 'Ahorro', v: money(m.totalSavings), c: m.totalSavings < 0 ? C.rojo : C.violeta },
        ];
        let xr = M + PW - 12;
        for (const r of [...resumen].reverse()) {
          const wv = doc.font('Helvetica-Bold').fontSize(9).widthOfString(r.v);
          const wt = doc.font('Helvetica').fontSize(6.5).widthOfString(r.t.toUpperCase());
          const w = Math.max(wv, wt);
          doc.font('Helvetica').fontSize(6.5).fillColor(C.tenue).text(r.t.toUpperCase(), xr - wt, y + 6);
          doc.font('Helvetica-Bold').fontSize(9).fillColor(r.c).text(r.v, xr - wv, y + 15);
          xr -= w + 22;
        }
      }
      y += 40;
    };

    for (const m of months) {
      asegurar(30 + 40 + 15 * 3); // la cabecera nunca queda sola al final de una página
      cabeceraMes(m);

      const lista = (tituloLista: string, color: string, items: { description: string; amount: number }[], total: number, marcarCero: boolean) => {
        asegurar(16 + 15 * Math.min(2, items.length || 1) + 18);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(color).text(tituloLista.toUpperCase(), M + 4, y, { characterSpacing: 1.2 });
        y += 14;
        if (!items.length) {
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(C.suave).text('Sin movimientos', M + 4, y);
          y += 15;
        }
        for (const it of items) {
          const h = altoFila(it.description);
          if (y + h > LIMITE) { nuevaPagina(); cabeceraMes(m, true); }
          const cero = marcarCero && Number(it.amount) === 0;
          doc.font('Helvetica').fontSize(8.5).fillColor(C.texto).text(it.description || '—', M + 4, y, { width: ANCHO_DESC });
          doc.font(cero ? 'Helvetica-Oblique' : 'Helvetica').fontSize(8.5).fillColor(cero ? C.ambar : C.texto)
            .text(cero ? 'sin importe' : money(it.amount), M + PW - 104, y, { width: 100, align: 'right' });
          y += h;
          doc.moveTo(M, y - 3).lineTo(M + PW, y - 3).lineWidth(0.4).strokeColor(C.borde).stroke();
        }
        // El total de egresos viaja con la franja del ahorro: sola arriba de una página no se
        // sabe de qué mes es.
        asegurar(marcarCero ? 76 : 18);
        y += 2;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(color).text(`Total ${tituloLista.toLowerCase()}`, M + 4, y);
        doc.text(money(total), M + PW - 104, y, { width: 100, align: 'right' });
        y += 20;
      };
      lista('Ingresos', C.verde, m.incomeItems, m.totalIncome, false);
      lista('Egresos', C.rojo, m.expenseItems, m.totalExpense, true);

      // El ahorro: una franja fina en el mes de un reporte de varios; con el acumulado (PDF de un
      // mes), tres fichas.
      if (m.priorSavings === undefined) {
        asegurar(28);
        doc.roundedRect(M, y, PW, 24, 5).fill(C.lavanda);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.tenue).text('AHORRO DEL MES', M + 12, y + 8.5, { characterSpacing: 1.2 });
        const v = money(m.totalSavings);
        const wv = doc.font('Helvetica-Bold').fontSize(10).widthOfString(v);
        doc.fillColor(m.totalSavings < 0 ? C.rojo : C.violeta).text(v, M + PW - 12 - wv, y + 7);
        y += 24 + 26;
      } else {
        const fichas = [
          { t: 'Ahorro del mes', v: m.totalSavings },
          { t: 'Acumulado al mes anterior', v: m.priorSavings },
          { t: 'Ahorro global a la fecha', v: m.priorSavings + m.totalSavings },
        ];
        const FW = (PW - GAP * 2) / 3;
        // La cifra va DEBAJO de lo que mida la etiqueta: con un alto fijo, una etiqueta de dos
        // líneas se montaba sobre el número (Fernando, 2026-10-29).
        const altoEtiqueta = Math.max(...fichas.map((f) => doc.font('Helvetica').fontSize(6.8).heightOfString(f.t.toUpperCase(), { width: FW - 24, characterSpacing: 0.8 })));
        const FH = 7 + altoEtiqueta + 4 + 14 + 8;
        asegurar(FH + 12);
        fichas.forEach((f, i) => {
          const x = M + i * (FW + GAP);
          const destacado = i === 2;
          doc.roundedRect(x, y, FW, FH, 6).fillAndStroke(destacado ? C.violeta : '#FFFFFF', destacado ? C.violeta : C.borde);
          doc.font('Helvetica').fontSize(6.8).fillColor(destacado ? C.lila : C.tenue).text(f.t.toUpperCase(), x + 12, y + 7, { width: FW - 24, characterSpacing: 0.8 });
          doc.font('Helvetica-Bold').fontSize(11).fillColor(destacado ? '#FFFFFF' : f.v < 0 ? C.rojo : C.tinta).text(money(f.v), x + 12, y + 7 + altoEtiqueta + 4, { width: FW - 24 });
        });
        y += FH + 26;
      }
    }

    // ── 5. PIE EN TODAS LAS PÁGINAS ────────────────────────────────────────────────────
    const rango = doc.bufferedPageRange();
    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);
      const margenAbajo = doc.page.margins.bottom;
      doc.page.margins.bottom = 0; // por debajo del margen; sin esto PDFKit abre otra página
      const yp = H - 34;
      doc.moveTo(M, yp - 8).lineTo(W - M, yp - 8).lineWidth(0.5).strokeColor(C.borde).stroke();
      doc.font('Helvetica').fontSize(7).fillColor(C.suave);
      doc.text('GCC World · Reporte financiero · Uso interno', M, yp, { lineBreak: false });
      const pag = `Página ${i - rango.start + 1} de ${rango.count}`;
      doc.text(pag, W - M - doc.widthOfString(pag), yp, { lineBreak: false });
      doc.page.margins.bottom = margenAbajo;
    }

    doc.end();
  });
}
