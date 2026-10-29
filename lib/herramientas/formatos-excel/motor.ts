// @ts-nocheck — motor portado TAL CUAL de la herramienta que entregó Fernando (2026-10-27,
// «Formatos de impresión Excel»). Es JavaScript compacto ya probado; tiparlo línea a línea
// solo arriesga cambiarle el comportamiento. La superficie tipada está en `./index.ts`.
//
// Todo corre en el NAVEGADOR: el .xlsx nunca sale del equipo de quien lo usa.
import * as fflate from 'fflate';

// Anchos de las fuentes estándar del PDF (Helvetica), en milésimas de em, desde el carácter 32.
// La cursiva mide igual que la normal y la negrita cursiva igual que la negrita.
const HELV_R = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const HELV_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];
const HELV_W = { R: HELV_R, B: HELV_B, I: HELV_R, BI: HELV_B };

// ===== Formatos preparados (configuración de impresión resuelta por tipo de archivo) =====
const MARGENES_NORMALES = { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };
export const FORMATS = [
  {
    // Libro de compras con carátula (Fernando, 2026-10-27; muestra: «Grupo Corazones Cruzados Feb 2024»).
    // CARATULA en UNA hoja A4; COMPRAS N. con sus 4 cuentas (B–H, J–P, R–X, Z–AF) en A3 horizontal.
    // Los encabezados de columna están en la fila 14: se repiten 6–14 (cuenta, totales y encabezados).
    id: 'compras',
    name: 'Formato de compras',
    summary: 'Carátula en una hoja A4 y Compras N. con sus 4 cuentas en A3 horizontal.',
    paperSize: 8, paperName: 'A3', orientation: 'landscape',
    margins: MARGENES_NORMALES, titleRows: { from: 6, to: 14 }, pageNumbers: true, printArea: 'data', colDesde: 'B',
    porHoja: [
      { hoja: /^CAR[AÁ]TULA$/i, paperSize: 9, paperName: 'A4', orientation: 'portrait', fitToHeight: 1,
        titleRows: null, pageNumbers: false, colDesde: 'A', colHasta: 'F' },
    ],
    detect: { hojas: [/^CAR[AÁ]TULA$/i, /COMPRAS/i] },
  },
  {
    // Libro de ventas + Cuentas (Fernando, 2026-10-27; muestra: «Ventas Enero 2024»). Primero el libro
    // (A–P, encabezado en la fila 1) en las hojas que haga falta; después Cuentas, con sus 2 tablas
    // (B–H y K–Q): títulos en 1–3, totales en 5 y encabezados en 6, que se repiten en cada hoja.
    id: 'ventas',
    name: 'Formato de ventas',
    summary: 'El libro de ventas completo y después Cuentas con sus 2 tablas, en A3 horizontal.',
    paperSize: 8, paperName: 'A3', orientation: 'landscape',
    margins: MARGENES_NORMALES, titleRows: { from: 1, to: 1 }, pageNumbers: true, printArea: 'data',
    // La fila de encabezados cambia de un mes a otro (2026-10-29): el libro de junio la tiene en la 4
    // (encima, totales) y Cuentas va de la 6 (enero) a la 9 (junio); en marzo sus dos tablas están
    // desfasadas (8 y 9). Se busca en las primeras filas y `titleRows` queda solo por si no aparece.
    encabezado: { patron: /\bNUMOPER\b/i },
    porHoja: [
      { hoja: /^CUENTAS$/i, titleRows: { from: 1, to: 6 }, colDesde: 'B', encabezado: { patron: /^\s*Fecha\s+Comprobante\b/i, desdeArriba: true } },
    ],
    detect: { hojas: [/LIBRO\s+(DE\s+)?VENTAS/i, /^CUENTAS$/i] },  // «Libro ventas Febrero 24» va sin «de»
  },
];

/**
 * La configuración que se aplica a UNA hoja: la del formato, con lo que cambie su entrada de
 * `porHoja` si la hay (añadido el 2026-10-27; los dos formatos primeros no la usan).
 * Opciones por hoja además de las del formato: `fitToHeight` (0 = alto automático, 1 = una
 * sola página), `colDesde`/`colHasta` (letras del área de impresión; por omisión A y la última
 * columna de la hoja).
 */
export function configDeHoja(fmt, nombre, sh, book) {
  const ov = (fmt.porHoja || []).find(o => o.hoja.test(nombre));
  const { porHoja, detect, ...base } = fmt;
  let cfg = base;
  if (ov) { const { hoja, ...cambios } = ov; cfg = { ...base, ...cambios }; }
  const enc = cfg.encabezado && sh && book ? filaEncabezado(sh, book, cfg.encabezado) : 0;
  return enc ? { ...cfg, titleRows: { from: cfg.encabezado.desdeArriba ? 1 : enc, to: enc } } : cfg;
}

/**
 * `encabezado`: la fila de encabezados se busca entre las 20 primeras con `patron`; si hay varias
 * tablas lado a lado desfasadas, vale la ÚLTIMA que lo cumpla, así se repiten las dos. Con
 * `desdeArriba` se repiten también las filas de encima (títulos y totales de Cuentas). 0 = no está.
 */
function filaEncabezado(sh, book, { patron }) {
  const cache = sh.encabezados || (sh.encabezados = new Map());
  if (cache.has(patron.source)) return cache.get(patron.source);
  let fila = 0;
  for (let k = 0; k < Math.min(20, sh.rIdx.length); k++) {
    if (sh.rIdx[k] > 20) break;
    let t = ''; try { t = XlsxPdf._rowText(sh, k, book).replace(/\s+/g, ' ').trim(); } catch (e) {}
    if (patron.test(t)) fila = sh.rIdx[k];
  }
  cache.set(patron.source, fila);
  return fila;
}

// ===== Núcleo: corrige la configuración de impresión de un .xlsx sin tocar datos ni formato =====
export const PrintFix = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8');

  function indexOfBytes(hay, needle, from = 0) {
    const n0 = needle[0], nl = needle.length, last = hay.length - nl;
    let i = hay.indexOf(n0, from);
    while (i !== -1 && i <= last) {
      let ok = true;
      for (let k = 1; k < nl; k++) if (hay[i + k] !== needle[k]) { ok = false; break; }
      if (ok) return i;
      i = hay.indexOf(n0, i + 1);
    }
    return -1;
  }
  function lastIndexOfBytes(hay, needle, from) {
    const n0 = needle[0], nl = needle.length;
    let i = hay.lastIndexOf(n0, from == null ? hay.length - nl : Math.min(from, hay.length - nl));
    while (i !== -1) {
      let ok = true;
      for (let k = 1; k < nl; k++) if (hay[i + k] !== needle[k]) { ok = false; break; }
      if (ok) return i;
      i = i === 0 ? -1 : hay.lastIndexOf(n0, i - 1);
    }
    return -1;
  }
  const xmlEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const xmlUnesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name.replace(':', '\\:') + '="([^"]*)"')); return m ? m[1] : null; };
  const num = v => String(Math.round(v * 10000) / 10000);

  // Quita un elemento (vacío o con contenido) de un fragmento XML
  function removeEl(xml, p, name) {
    const re = new RegExp(`<${p}${name}\\b[^>]*?(?:/>|>[\\s\\S]*?</${p}${name}>)`, 'g');
    return xml.replace(re, '');
  }

  function fixHead(head, p) {
    const sp = new RegExp(`<${p}sheetPr\\b[^>]*?/>`);
    const spFull = new RegExp(`(<${p}sheetPr\\b[^>]*>)([\\s\\S]*?)(</${p}sheetPr>)`);
    const psp = `<${p}pageSetUpPr fitToPage="1"/>`;
    if (spFull.test(head)) {
      return head.replace(spFull, (m, a, inner, c) => {
        const pr = new RegExp(`<${p}pageSetUpPr\\b([^>]*?)/>`);
        if (pr.test(inner)) {
          inner = inner.replace(pr, (mm, at) => `<${p}pageSetUpPr${at.replace(/\s+fitToPage="[^"]*"/, '')} fitToPage="1"/>`);
        } else inner = inner + psp;
        return a + inner + c;
      });
    }
    if (sp.test(head)) return head.replace(sp, m => m.slice(0, -2) + '>' + psp + `</${p}sheetPr>`);
    return head.replace(new RegExp(`(<${p}worksheet\\b[^>]*>)`), `$1<${p}sheetPr>${psp}</${p}sheetPr>`);
  }

  function fixTail(tail, p, o) {
    let t = tail;
    for (const n of ['pageMargins', 'pageSetup', 'colBreaks']) t = removeEl(t, p, n);
    if (o.pageNumbers) t = removeEl(t, p, 'headerFooter');
    const m = o.margins;
    let ins = `<${p}pageMargins left="${num(m.left)}" right="${num(m.right)}" top="${num(m.top)}" bottom="${num(m.bottom)}" header="${num(m.header)}" footer="${num(m.footer)}"/>` +
      `<${p}pageSetup paperSize="${o.paperSize}" orientation="${o.orientation}" fitToWidth="1" fitToHeight="${o.fitToHeight || 0}"/>`;
    if (o.pageNumbers) ins += `<${p}headerFooter><${p}oddFooter>&amp;CPágina &amp;P de &amp;N</${p}oddFooter></${p}headerFooter>`;
    const after = (o.pageNumbers ? [] : ['headerFooter']).concat(['rowBreaks', 'colBreaks', 'customProperties', 'cellWatches',
      'ignoredErrors', 'smartTags', 'drawing', 'legacyDrawing', 'legacyDrawingHF', 'drawingHF', 'picture', 'oleObjects',
      'controls', 'webPublishItems', 'tableParts', 'extLst']);
    let pos = -1;
    for (const n of after) {
      const mm = new RegExp(`<${p}${n}[\\s/>]`).exec(t);
      if (mm && (pos === -1 || mm.index < pos)) pos = mm.index;
    }
    if (pos === -1) pos = t.lastIndexOf(`</${p}worksheet`);
    return t.slice(0, pos) + ins + t.slice(pos);
  }

  function fixSheet(u8, o) {
    // localizar <sheetData (con o sin prefijo)
    const headProbe = dec.decode(u8.subarray(0, Math.min(u8.length, 4096)));
    const rm = headProbe.match(/<(\w+:)?worksheet[\s>]/);
    if (!rm) throw new Error('Hoja con formato no reconocido');
    const p = rm[1] || '';
    const open = indexOfBytes(u8, enc.encode(`<${p}sheetData`));
    if (open === -1) throw new Error('La hoja no tiene datos (sheetData)');
    let tailStart;
    const close = lastIndexOfBytes(u8, enc.encode(`</${p}sheetData>`));
    if (close !== -1) tailStart = close + `</${p}sheetData>`.length;
    else { // <sheetData/>
      tailStart = indexOfBytes(u8, enc.encode('/>'), open) + 2;
    }
    const head = dec.decode(u8.subarray(0, open));
    const middle = u8.subarray(open, tailStart);
    const tail = dec.decode(u8.subarray(tailStart));
    const h2 = enc.encode(fixHead(head, p));
    const t2 = enc.encode(fixTail(tail, p, o));
    const out = new Uint8Array(h2.length + middle.length + t2.length);
    out.set(h2, 0); out.set(middle, h2.length); out.set(t2, h2.length + middle.length);
    const dim = head.match(new RegExp(`<${p}dimension\\s+ref="([^"]*)"`));
    // última fila con valores (las filas que solo tienen formato no cuentan)
    let lastRow = 0;
    const lv = Math.max(lastIndexOfBytes(u8, enc.encode(`</${p}v>`), tailStart), lastIndexOfBytes(u8, enc.encode(`</${p}is>`), tailStart));
    if (lv > open) {
      const rs = lastIndexOfBytes(u8, enc.encode(`<${p}row `), lv);
      if (rs > 0) { const m = dec.decode(u8.subarray(rs, Math.min(rs + 200, u8.length))).match(/\sr="(\d+)"/); if (m) lastRow = +m[1]; }
    }
    const lastCol = dim ? (dim[1].split(':')[1] || dim[1]).replace(/[0-9$]/g, '') : 'A';
    return { data: out, range: dim ? dim[1] : '', lastRow, lastCol };
  }

  function fixWorkbook(wb, sheetsToFix, o) {
    const rm = wb.match(/<(\w+:)?workbook[\s>]/);
    const p = (rm && rm[1]) || '';
    let names = [];
    if (o.titleRows) {
      for (const s of sheetsToFix) {
        const q = "'" + s.name.replace(/'/g, "''") + "'";
        names.push({ idx: s.index, xml: `<${p}definedName name="_xlnm.Print_Titles" localSheetId="${s.index}">${xmlEsc(q)}!$${o.titleRows.from}:$${o.titleRows.to}</${p}definedName>` });
      }
    }
    if (o.printArea === 'data') {
      for (const s of sheetsToFix) if (s.lastRow) {
        const q = "'" + s.name.replace(/'/g, "''") + "'";
        names.push({ idx: s.index, xml: `<${p}definedName name="_xlnm.Print_Area" localSheetId="${s.index}">${xmlEsc(q)}!$${o.colDesde || 'A'}$1:$${o.colHasta || s.lastCol}$${s.lastRow}</${p}definedName>` });
      }
    }
    // quitar Print_Titles / Print_Area previos de las hojas tratadas
    const ids = new Set(sheetsToFix.map(s => String(s.index)));
    wb = wb.replace(new RegExp(`<${p}definedName\\b[^>]*>[\\s\\S]*?</${p}definedName>`, 'g'), m => {
      const tag = m.match(/^<[^>]*>/)[0]; const n = attr(tag, 'name');
      if (!ids.has(attr(tag, 'localSheetId'))) return m;
      if (n === '_xlnm.Print_Titles' && o.titleRows) return '';
      if (n === '_xlnm.Print_Area' && o.printArea === 'data') return '';
      return m;
    });
    if (!names.length) return wb;
    const add = names.map(n => n.xml).join('');
    if (new RegExp(`</${p}definedNames>`).test(wb)) return wb.replace(`</${p}definedNames>`, add + `</${p}definedNames>`);
    if (new RegExp(`<${p}definedNames\\s*/>`).test(wb)) return wb.replace(new RegExp(`<${p}definedNames\\s*/>`), `<${p}definedNames>${add}</${p}definedNames>`);
    // crear definedNames después de sheets / functionGroups / externalReferences
    let anchor = -1, len = 0;
    for (const n of ['externalReferences', 'functionGroups', 'sheets']) {
      const mm = new RegExp(`</${p}${n}>|<${p}${n}\\b[^>]*/>`).exec(wb);
      if (mm) { anchor = mm.index; len = mm[0].length; break; }
    }
    return wb.slice(0, anchor + len) + `<${p}definedNames>${add}</${p}definedNames>` + wb.slice(anchor + len);
  }

  function resolve(base, target) {
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/'); parts.pop();
    for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
    return parts.join('/');
  }

  // Lee la lista de hojas del libro: [{name, index, path}]
  function listSheets(files) {
    const rootRels = dec.decode(files['_rels/.rels']);
    const wbTarget = (rootRels.match(/<Relationship\b[^>]*officeDocument"[^>]*>/) || [''])[0];
    const wbPath = resolve('', attr(wbTarget, 'Target') || 'xl/workbook.xml');
    const relsPath = wbPath.replace(/[^/]+$/, m => '_rels/' + m + '.rels');
    const wb = dec.decode(files[wbPath]);
    const rels = dec.decode(files[relsPath]);
    const relMap = {};
    for (const r of rels.match(/<Relationship\b[^>]*>/g) || []) relMap[attr(r, 'Id')] = { target: attr(r, 'Target'), type: attr(r, 'Type') || '' };
    const sheets = [];
    const tags = wb.match(/<(\w+:)?sheet\b[^>]*\/?>/g) || [];
    tags.forEach((tag, i) => {
      const rid = (tag.match(/\s[\w]+:id="([^"]*)"/) || [])[1];
      const rel = relMap[rid];
      const path = rel ? resolve(wbPath, rel.target) : null;
      sheets.push({ name: xmlUnesc(attr(tag, 'name') || ''), index: i, path,
        isWorksheet: !!(rel && /\/worksheet$/.test(rel.type) && files[path]) });
    });
    return { wbPath, sheets };
  }

  return { fixSheet, fixWorkbook, listSheets, indexOfBytes, lastIndexOfBytes };
})();


// ===== Generador de PDF: imprime las hojas como lo haría Excel con su configuración de página =====
export const XlsxPdf = (() => {
  const dec = new TextDecoder('utf-8');
  const WIN = { 0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x02C6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017D: 142, 0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02DC: 152, 0x2122: 153, 0x0161: 154, 0x203A: 155, 0x0153: 156, 0x017E: 158, 0x0178: 159 };
  const FONT_KEYS = ['R', 'B', 'I', 'BI'];
  const PAPER = { 1: [612, 792], 5: [612, 1008], 8: [841.89, 1190.55], 9: [595.28, 841.89], 11: [419.53, 595.28] };
  const MDW = 7; // ancho de dígito máximo (px) de la fuente estándar a 11 pt
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MONTHS_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const COLORS = { red: [1, 0, 0], blue: [0, 0, 1], green: [0, .5, 0], magenta: [1, 0, 1], cyan: [0, 1, 1], yellow: [1, 1, 0], white: [1, 1, 1], black: [0, 0, 0] };

  const xmlUnesc = s => s.indexOf('&') < 0 ? s : s.replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '="([^"]*)"')); return m ? m[1] : null; };
  const colIdx = ref => { let n = 0, i = 0; for (; i < ref.length; i++) { const c = ref.charCodeAt(i); if (c < 65 || c > 90) break; n = n * 26 + c - 64; } return n; };
  const rowOf = ref => parseInt(ref.replace(/^[A-Z$]+/, '').replace('$', ''), 10);
  const parseRange = ref => { const [a, b] = ref.replace(/\$/g, '').split(':'); const bb = b || a; return { c1: colIdx(a) || 1, r1: rowOf(a) || 1, c2: colIdx(bb) || 16384, r2: rowOf(bb) || 1048576 }; };
  function resolve(base, target) {
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/'); parts.pop();
    for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
    return parts.join('/');
  }
  const f2 = n => { const s = (Math.round(n * 100) / 100).toString(); return s === '-0' ? '0' : s; };
  const rgbOf = c => { if (!c) return null; const m = /^([0-9A-F]{2})?([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(c); return m ? [parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255, parseInt(m[4], 16) / 255] : null; };

  // ---------- texto WinAnsi y medidas ----------
  function win(str) {
    let out = '';
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      let c = cp < 128 ? cp : (cp >= 160 && cp <= 255 ? cp : (WIN[cp] || 63));
      if (c < 32) c = 32;
      out += String.fromCharCode(c);
    }
    return out;
  }
  function measure(w, fk) { const t = HELV_W[fk]; let s = 0; for (let i = 0; i < w.length; i++) { const c = w.charCodeAt(i); s += c >= 32 ? t[c - 32] : 278; } return s / 1000; }
  const pdfStr = w => '(' + w.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ')';

  // ---------- formatos de número ----------
  function makeFormatter(loc, date1904) {
    const BUILTIN = { 0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: 'General', 13: 'General', 14: loc.date, 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: loc.date + ' h:mm', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0', 48: '##0.0E+0', 49: '@' };
    const cache = new Map();
    const splitSec = code => { const out = []; let cur = '', q = false; for (let i = 0; i < code.length; i++) { const ch = code[i]; if (ch === '"') q = !q; if (ch === '\\' && !q) { cur += ch + (code[i + 1] || ''); i++; continue; } if (ch === ';' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
    const isDateSec = s => /[dmyhs]/i.test(s.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[[^\]]*\]/g, m => /^\[h+\]|^\[m+\]|^\[s+\]/i.test(m) ? 'h' : '').replace(/_./g, '').replace(/E\+/gi, ''));
    function general(v) {
      if (typeof v !== 'number') return String(v);
      if (Number.isInteger(v) && Math.abs(v) < 1e11) return String(v);
      let s;
      if (Math.abs(v) >= 1e11 || (Math.abs(v) < 1e-9 && v !== 0)) s = v.toExponential(5).replace(/\.?0+e/, 'e').replace('e', 'E').replace(/E([+-])(\d)$/, 'E$10$2');
      else { s = String(parseFloat(v.toPrecision(10))); if (s.includes('e')) s = v.toFixed(10).replace(/0+$/, ''); }
      return s.replace('.', loc.dec);
    }
    function group(intStr) { if (!loc.thou) return intStr; let o = ''; for (let i = 0; i < intStr.length; i++) { if (i && (intStr.length - i) % 3 === 0) o += loc.thou; o += intStr[i]; } return o; }
    function tokenize(sec) {
      const toks = []; let color = null;
      for (let i = 0; i < sec.length; i++) {
        const ch = sec[i];
        if (ch === '"') { const j = sec.indexOf('"', i + 1); toks.push({ t: 'lit', v: sec.slice(i + 1, j < 0 ? sec.length : j) }); i = j < 0 ? sec.length : j; }
        else if (ch === '\\') { toks.push({ t: 'lit', v: sec[i + 1] || '' }); i++; }
        else if (ch === '_') { toks.push({ t: 'lit', v: ' ' }); i++; }
        else if (ch === '*') { toks.push({ t: 'fill' }); i++; }
        else if (ch === '[') { const j = sec.indexOf(']', i); const inner = sec.slice(i + 1, j); i = j;
          if (COLORS[inner.toLowerCase()]) color = COLORS[inner.toLowerCase()];
          else if (inner[0] === '$') { const cur = inner.slice(1).split('-')[0]; if (cur) toks.push({ t: 'lit', v: cur }); }
          else if (/^[hms]+$/i.test(inner)) toks.push({ t: 'el', v: inner.toLowerCase() }); }
        else toks.push({ t: 'ch', v: ch });
      }
      return { toks, color };
    }
    function fmtNumber(sec, v, neg) {
      const { toks, color } = tokenize(sec);
      // bloque numérico
      let i = 0; const parts = []; let numDone = false;
      while (i < toks.length) {
        const k = toks[i];
        if (!numDone && k.t === 'ch' && (/[0#?]/.test(k.v) || (/[.,]/.test(k.v) && toks[i + 1] && toks[i + 1].t === 'ch' && /[0#?]/.test(toks[i + 1].v)))) {
          let pat = ''; while (i < toks.length && toks[i].t === 'ch' && /[0#?.,]/.test(toks[i].v)) { pat += toks[i].v; i++; }
          let sci = '';
          if (i < toks.length && toks[i].t === 'ch' && /e/i.test(toks[i].v) && toks[i + 1] && /[+-]/.test(toks[i + 1].v)) { sci = toks[i + 1].v; i += 2; let ep = ''; while (i < toks.length && toks[i].t === 'ch' && /[0#]/.test(toks[i].v)) { ep += toks[i].v; i++; } sci += ep; }
          parts.push({ t: 'num', pat, sci }); numDone = true; continue;
        }
        if (k.t === 'fill') parts.push({ t: 'fill' });
        else if (k.t === 'ch' && k.v === '%') { parts.push({ t: 'lit', v: '%' }); v *= 100; }
        else if (k.t === 'ch' && k.v === '@') parts.push({ t: 'lit', v: '' });
        else parts.push({ t: 'lit', v: k.v });
        i++;
      }
      const out = [];
      for (const p of parts) {
        if (p.t !== 'num') { out.push(p); continue; }
        let pat = p.pat; let scaleDiv = 0; while (pat.endsWith(',')) { pat = pat.slice(0, -1); scaleDiv++; }
        let x = v / Math.pow(1000, scaleDiv);
        const di = pat.indexOf('.');
        const ip = di < 0 ? pat : pat.slice(0, di), dp = di < 0 ? '' : pat.slice(di + 1).replace(/,/g, '');
        const nd = dp.replace(/[^0#?]/g, '').length;
        const minInt = (ip.match(/0/g) || []).length, qInt = (ip.match(/\?/g) || []).length;
        const grouping = /[0#?],[0#?]/.test(ip);
        let txt;
        if (p.sci) {
          let e = x === 0 ? 0 : Math.floor(Math.log10(Math.abs(x)));
          let m = x / Math.pow(10, e); let ms = m.toFixed(nd); if (Math.abs(parseFloat(ms)) >= 10) { e++; ms = (x / Math.pow(10, e)).toFixed(nd); }
          const ed = p.sci.replace(/[+-]/, '').length || 2;
          txt = ms.replace('.', loc.dec) + 'E' + (e < 0 ? '-' : '+') + String(Math.abs(e)).padStart(ed, '0');
        } else {
          let [is, ds = ''] = x.toFixed(nd).split('.');
          if (is === '0' && minInt === 0) is = '';
          if (is.length < minInt) is = is.padStart(minInt, '0');
          if (grouping) is = group(is);
          if (is.length < qInt) is = is.padStart(qInt, ' ');
          // decimales opcionales (#) se recortan
          const optional = (dp.match(/#/g) || []).length;
          if (optional) { let cut = 0; while (cut < optional && ds.endsWith('0')) { ds = ds.slice(0, -1); cut++; } }
          const qdec = /\?/.test(dp);
          if (qdec) ds = ds.padEnd(nd, ' ');
          txt = di >= 0 ? is + loc.dec + ds : is;
        }
        out.push({ t: 'lit', v: txt });
      }
      let left = '', right = '', fill = false;
      for (const p of out) { if (p.t === 'fill') { fill = true; continue; } if (fill) right += p.v; else left += p.v; }
      if (neg) left = '-' + left;
      return fill ? { left, text: right, fill: true, color } : { text: left, color };
    }
    function fmtDate(sec, v) {
      const { toks, color } = tokenize(sec);
      const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
      const ms = Math.round((v * 86400)) * 1000;
      const d = new Date(base + ms);
      const Y = d.getUTCFullYear(), M = d.getUTCMonth(), D = d.getUTCDate(), h = d.getUTCHours(), mi = d.getUTCMinutes(), s = d.getUTCSeconds();
      const ampm = /AM\/PM|A\/P/i.test(sec);
      // recorrer tokens de fecha
      let i = 0; let lastWasH = false; const list = [];
      while (i < toks.length) {
        const k = toks[i];
        if (k.t === 'el') { const n = k.v[0] === 'h' ? Math.floor(v * 24) : k.v[0] === 'm' ? Math.floor(v * 1440) : Math.floor(v * 86400); list.push(String(n).padStart(k.v.length, '0')); i++; continue; }
        if (k.t !== 'ch') { if (k.t === 'lit') list.push(k.v); i++; continue; }
        const c = k.v.toLowerCase();
        if ('ydmhs'.includes(c)) {
          let n = 0; while (i < toks.length && toks[i].t === 'ch' && toks[i].v.toLowerCase() === c) { n++; i++; }
          if (c === 'y') list.push(n <= 2 ? String(Y % 100).padStart(2, '0') : String(Y));
          else if (c === 'd') list.push(n === 1 ? String(D) : n === 2 ? String(D).padStart(2, '0') : n === 3 ? ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getUTCDay()] : ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getUTCDay()]);
          else if (c === 'h') { let hh = ampm ? (h % 12 || 12) : h; list.push(n >= 2 ? String(hh).padStart(2, '0') : String(hh)); lastWasH = true; continue; }
          else if (c === 's') list.push(n >= 2 ? String(s).padStart(2, '0') : String(s));
          else if (c === 'm') {
            let rest = toks.slice(i).filter(t => t.t === 'ch' && /[a-z]/i.test(t.v)); const nextIsS = rest.length && rest[0].v.toLowerCase() === 's';
            if (lastWasH || nextIsS) list.push(n >= 2 ? String(mi).padStart(2, '0') : String(mi));
            else list.push(n === 1 ? String(M + 1) : n === 2 ? String(M + 1).padStart(2, '0') : n === 3 ? MONTHS[M] : n === 5 ? MONTHS[M][0] : MONTHS_L[M]);
          }
          lastWasH = false; continue;
        }
        if (c === 'a' && ampm) { const look = toks.slice(i, i + 5).map(t => t.v || '').join('').toUpperCase(); const am = look === 'AM/PM'; if (am || look.startsWith('A/P')) { list.push(h < 12 ? (am ? 'a. m.' : 'a') : (am ? 'p. m.' : 'p')); i += am ? 5 : 3; continue; } }
        list.push(k.v); i++;
      }
      return { text: list.join(''), color };
    }
    return function format(numFmtId, code, v, isText) {
      let fc = code != null ? code : BUILTIN[numFmtId];
      if (fc == null) fc = 'General';
      let entry = cache.get(fc);
      if (!entry) { const secs = splitSec(fc); entry = { secs, date: secs.map(isDateSec) }; cache.set(fc, entry); }
      const { secs } = entry;
      if (isText) {
        const ts = secs.length >= 4 ? secs[3] : (secs.length === 1 && secs[0].includes('@') ? secs[0] : null);
        if (!ts) return { text: v };
        const r = fmtNumber(ts.replace('@', '\u0000'), 0, false);
        const rep = x => x.replace('\u0000', v);
        return r.fill ? { left: rep(r.left), text: rep(r.text), fill: true } : { text: rep(r.text) };
      }
      if (typeof v !== 'number') return { text: String(v) };
      let si = 0, neg = false;
      if (v < 0 && secs.length >= 2) si = 1; else if (v === 0 && secs.length >= 3) si = 2;
      let sec = secs[si];
      if (/^General$/i.test(sec.trim())) return { text: general(si === 1 ? Math.abs(v) : v), num: true };
      if (entry.date[si]) return { ...fmtDate(sec, v), num: true };
      if (v < 0 && si === 0) neg = true;
      const r = fmtNumber(sec, Math.abs(v), neg);
      r.num = true; return r;
    };
  }

  // ---------- lectura del libro ----------
  function readWorkbook(files, wbPath) {
    const rels = dec.decode(files[wbPath.replace(/[^/]+$/, m => '_rels/' + m + '.rels')]);
    const relMap = {};
    for (const r of rels.match(/<Relationship\b[^>]*>/g) || []) relMap[attr(r, 'Id')] = { target: resolve(wbPath, attr(r, 'Target')), type: attr(r, 'Type') || '' };
    const find = t => Object.values(relMap).find(r => r.type.endsWith('/' + t));
    const wb = dec.decode(files[wbPath]);
    const date1904 = /date1904="(1|true)"/.test(wb);
    const names = [];
    for (const m of wb.matchAll(/<(?:\w+:)?definedName\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?definedName>/g)) names.push({ name: attr(' ' + m[1], 'name'), sheet: attr(' ' + m[1], 'localSheetId'), ref: xmlUnesc(m[2]) });
    // estilos
    const st = find('styles'); const sx = st && files[st.target] ? dec.decode(files[st.target]) : '';
    const numFmts = {};
    for (const m of sx.matchAll(/<(?:\w+:)?numFmt\b[^>]*>/g)) numFmts[attr(m[0], 'numFmtId')] = xmlUnesc(attr(m[0], 'formatCode') || '');
    const sect = (tag) => { const m = sx.match(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`)); return m ? m[1] : ''; };
    const fonts = [...sect('fonts').matchAll(/<(?:\w+:)?font\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?font>)/g)].map(m => {
      const x = m[1] || ''; const name = (x.match(/<(?:\w+:)?name\s+val="([^"]*)"/) || [])[1] || '';
      const b = /<(?:\w+:)?b(\s+val="(1|true)")?\s*\/>/.test(x) && !/<(?:\w+:)?b\s+val="(0|false)"/.test(x);
      const it = /<(?:\w+:)?i(\s+val="(1|true)")?\s*\/>/.test(x) && !/<(?:\w+:)?i\s+val="(0|false)"/.test(x);
      const sz = parseFloat((x.match(/<(?:\w+:)?sz\s+val="([^"]*)"/) || [])[1] || '11');
      const col = rgbOf((x.match(/<(?:\w+:)?color\s+rgb="([^"]*)"/) || [])[1]);
      const tz = /narrow|condensed/i.test(name) ? 82 : /calibri|aptos|carlito|segoe/i.test(name) ? 90 : 100;
      return { fk: b && it ? 'BI' : b ? 'B' : it ? 'I' : 'R', sz, color: col && (col[0] + col[1] + col[2] > 0) ? col : null, tz };
    });
    const fills = [...sect('fills').matchAll(/<(?:\w+:)?fill\b[^>]*>([\s\S]*?)<\/(?:\w+:)?fill>/g)].map(m => {
      if (!/patternType="solid"/.test(m[1])) return null; return rgbOf((m[1].match(/<(?:\w+:)?fgColor\s+rgb="([^"]*)"/) || [])[1]);
    });
    const BW = { thin: .5, hair: .25, dotted: .5, dashed: .5, medium: 1, mediumDashed: 1, thick: 1.5, double: 1.5, slantDashDot: 1 };
    const borders = [...sect('borders').matchAll(/<(?:\w+:)?border\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?border>)/g)].map(m => {
      const x = m[1] || ''; const o = {};
      for (const side of ['left', 'right', 'top', 'bottom']) { const s = x.match(new RegExp(`<(?:\\w+:)?${side}\\s+style="([^"]*)"`)); if (s && BW[s[1]]) o[side[0]] = BW[s[1]]; }
      return o;
    });
    const xfs = [...sect('cellXfs').matchAll(/<(?:\w+:)?xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?xf>)/g)].map(m => {
      const a = ' ' + m[1], al = (m[2] || '').match(/<(?:\w+:)?alignment\b[^>]*>/);
      const nf = attr(a, 'numFmtId') || '0';
      return { nf: +nf, code: numFmts[nf], font: fonts[+(attr(a, 'fontId') || 0)] || fonts[0], fill: fills[+(attr(a, 'fillId') || 0)] || null,
        border: borders[+(attr(a, 'borderId') || 0)] || {}, h: al ? attr(al[0], 'horizontal') : null, v: al ? attr(al[0], 'vertical') : null, wrap: al ? attr(al[0], 'wrapText') === '1' : false };
    });
    if (!xfs.length) xfs.push({ nf: 0, font: fonts[0] || { fk: 'R', sz: 11, tz: 90 }, fill: null, border: {}, h: null, v: null, wrap: false });
    // textos compartidos
    const ss = find('sharedStrings'); const strings = [];
    if (ss && files[ss.target]) {
      const sxml = dec.decode(files[ss.target]);
      const re = /<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>|<(?:\w+:)?si\/>/g; let m;
      while ((m = re.exec(sxml))) {
        let x = m[1] || '';
        if (x.indexOf('<rPh') >= 0) x = x.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '');
        let t = ''; const tr = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g; let q; while ((q = tr.exec(x))) t += q[1];
        strings.push(xmlUnesc(t));
      }
    }
    return { names, date1904, xfs, strings };
  }

  // ---------- lectura de una hoja (índice de filas, sin cargar todas las celdas) ----------
  // La hoja se queda en BYTES y cada fila se decodifica al leerla: V8 no crea textos de más de
  // 536.870.888 caracteres y hay hojas de 634–791 MB (ventas de febrero, marzo y junio de 2024).
  const encS = new TextEncoder();
  const B_SD = encS.encode('sheetData'), B_SDC = encS.encode('sheetData>'), B_ROWC = encS.encode('row>');
  const esNombre = b => (b >= 0x61 && b <= 0x7A) || (b >= 0x41 && b <= 0x5A) || (b >= 0x30 && b <= 0x39) || b === 0x5F;
  const esFinNombre = b => b === 0x20 || b === 0x3E || b === 0x2F || b === 0x09 || b === 0x0A || b === 0x0D;
  function readSheet(u8) {
    let sdOpen = PrintFix.indexOfBytes(u8, B_SD);
    sdOpen = sdOpen === -1 ? -1 : u8.lastIndexOf(0x3C, sdOpen);
    let sdClose = PrintFix.lastIndexOfBytes(u8, B_SDC); if (sdClose < sdOpen) sdClose = sdOpen + 10;
    const head = dec.decode(u8.subarray(0, Math.max(sdOpen, 0))), tail = dec.decode(u8.subarray(Math.max(sdClose, sdOpen, 0)));
    const sfp = (head.match(/<(?:\w+:)?sheetFormatPr\b[^>]*>/) || [''])[0];
    const defW = attr(sfp, 'defaultColWidth') ? parseFloat(attr(sfp, 'defaultColWidth')) : (parseFloat(attr(sfp, 'baseColWidth') || '8') + 5 / MDW);
    const defH = parseFloat(attr(sfp, 'defaultRowHeight') || '15');
    const cols = [...head.matchAll(/<(?:\w+:)?col\b[^>]*>/g)].map(m => ({ min: +attr(m[0], 'min'), max: +attr(m[0], 'max'), w: attr(m[0], 'width') ? parseFloat(attr(m[0], 'width')) : defW, hidden: attr(m[0], 'hidden') === '1' }));
    const dim = (head.match(/<(?:\w+:)?dimension\s+ref="([^"]*)"/) || [])[1];
    const fitToPage = /<(?:\w+:)?pageSetUpPr\b[^>]*fitToPage="(1|true)"/.test(head);
    const ps = (tail.match(/<(?:\w+:)?pageSetup\b[^>]*>/) || [''])[0];
    const pm = (tail.match(/<(?:\w+:)?pageMargins\b[^>]*>/) || [''])[0];
    const hf = (tail.match(/<(?:\w+:)?headerFooter\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?headerFooter>/) || []);
    const hfx = hf[2] || '';
    const getHF = t => { const m = hfx.match(new RegExp(`<(?:\\w+:)?${t}>([\\s\\S]*?)</(?:\\w+:)?${t}>`)); return m ? xmlUnesc(m[1]) : ''; };
    const rowBreaks = new Set([...((tail.match(/<(?:\w+:)?rowBreaks\b[\s\S]*?<\/(?:\w+:)?rowBreaks>/) || [''])[0]).matchAll(/<(?:\w+:)?brk\b[^>]*>/g)].map(m => +attr(m[0], 'id')));
    const colBreaks = new Set([...((tail.match(/<(?:\w+:)?colBreaks\b[\s\S]*?<\/(?:\w+:)?colBreaks>/) || [''])[0]).matchAll(/<(?:\w+:)?brk\b[^>]*>/g)].map(m => +attr(m[0], 'id')));
    const merges = [...tail.matchAll(/<(?:\w+:)?mergeCell\s+ref="([^"]*)"/g)].map(m => parseRange(m[1]));
    const po = (tail.match(/<(?:\w+:)?printOptions\b[^>]*>/) || [''])[0];
    const num = (t, a, d) => { const v = attr(t, a); return v == null ? d : parseFloat(v); };
    const setup = {
      paper: +(attr(ps, 'paperSize') || 1), landscape: attr(ps, 'orientation') === 'landscape', scale: num(ps, 'scale', 100),
      fitToPage, fitW: num(ps, 'fitToWidth', 1), fitH: num(ps, 'fitToHeight', 1),
      overThenDown: attr(ps, 'pageOrder') === 'overThenDown',
      m: { l: num(pm, 'left', .7), r: num(pm, 'right', .7), t: num(pm, 'top', .75), b: num(pm, 'bottom', .75), h: num(pm, 'header', .3), f: num(pm, 'footer', .3) },
      header: getHF('oddHeader'), footer: getHF('oddFooter'), hfScale: attr(' ' + (hf[1] || ''), 'scaleWithDoc') !== '0',
      hCenter: attr(po, 'horizontalCentered') === '1', grid: attr(po, 'gridLines') === '1',
    };
    // índice de filas
    const rIdx = [], rStart = [], rEnd = [], rH = [];
    // `<row …>` o `<x:row …>`; tras una fila con celdas se salta a su cierre
    let i = sdOpen, prev = 0;
    while (sdOpen !== -1 && (i = u8.indexOf(0x3C, i + 1)) !== -1 && i <= sdClose) {
      let j = i + 1; while (j < i + 12 && esNombre(u8[j])) j++;
      const n = u8[j] === 0x3A ? j + 1 : i + 1;
      if (u8[n] !== 0x72 || u8[n + 1] !== 0x6F || u8[n + 2] !== 0x77 || !esFinNombre(u8[n + 3])) continue;
      const gt = u8.indexOf(0x3E, n + 3); if (gt === -1) break;
      const vacia = u8[gt - 1] === 0x2F;
      const a = dec.decode(u8.subarray(n + 3, vacia ? gt - 1 : gt));
      const r = attr(' ' + a, 'r'); const rr = r ? +r : prev + 1; prev = rr;
      const hid = / hidden="(1|true)"/.test(' ' + a);
      const ht = / ht="([^"]*)"/.exec(' ' + a);
      let st = gt + 1, en = st; i = gt;
      if (!vacia) { const close = PrintFix.indexOfBytes(u8, B_ROWC, st); if (close === -1) break; en = u8.lastIndexOf(0x3C, close); i = close + 3; }
      rIdx.push(rr); rStart.push(st); rEnd.push(en); rH.push(hid ? 0 : (ht ? parseFloat(ht[1]) : defH));
    }
    return { u8, cols, defW, defH, dim, setup, rowBreaks, colBreaks, merges, rIdx, rStart, rEnd, rH };
  }

  function rowCells(sh, k, book, fmt) {
    const st = sh.rStart[k], en = sh.rEnd[k];
    const cells = [];
    if (en <= st) return cells;
    const seg = dec.decode(sh.u8.subarray(st, en));
    const re = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g; let m, prevC = 0;
    while ((m = re.exec(seg))) {
      const a = ' ' + m[1]; const r = / r="([A-Z]+)/.exec(a); const c = r ? colIdx(r[1]) : prevC + 1; prevC = c;
      const sI = / s="(\d+)"/.exec(a); const xf = book.xfs[sI ? +sI[1] : 0] || book.xfs[0];
      const t = (/ t="(\w+)"/.exec(a) || [])[1] || 'n';
      const inner = m[2] || '';
      let val = null, isText = false;
      if (t === 'inlineStr') { let q, tt = ''; const tr = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g; while ((q = tr.exec(inner))) tt += q[1]; val = xmlUnesc(tt); isText = true; }
      else {
        const v = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner);
        if (v) {
          if (t === 's') { val = book.strings[+v[1]] ?? ''; isText = true; }
          else if (t === 'str') { val = xmlUnesc(v[1]); isText = true; }
          else if (t === 'b') { val = v[1] === '1' ? 'VERDADERO' : 'FALSO'; isText = true; }
          else if (t === 'e') { val = v[1]; isText = true; }
          else { val = parseFloat(v[1]); }
        }
      }
      const cell = { c, xf, val: null };
      if (val !== null && val !== '') {
        const f = fmt(xf.nf, xf.code, val, isText);
        cell.val = f; cell.isNum = !isText; cell.bool = t === 'b'; cell.err = t === 'e';
      }
      cells.push(cell);
    }
    return cells;
  }

  // ---------- encabezado / pie ----------
  function hfSections(code) {
    const out = { L: '', C: '', R: '' }; let cur = 'C'; let i = 0; let buf = '';
    const flush = () => { out[cur] += buf; buf = ''; };
    while (i < code.length) {
      const ch = code[i];
      if (ch === '&') {
        const n = code[i + 1];
        if (n === 'L' || n === 'C' || n === 'R') { flush(); cur = n; i += 2; continue; }
        if (n === '"') { const j = code.indexOf('"', i + 2); i = j + 1; continue; }
        if (/\d/.test(n)) { i += 1; while (/\d/.test(code[i])) i++; continue; }
        if (n === 'K') { i += 8; continue; }
        if ('BIUSEXYHO'.includes(n)) { i += 2; continue; }
        buf += '&' + n; i += 2; continue;
      }
      buf += ch; i++;
    }
    flush(); return out;
  }

  // ---------- escritor PDF ----------
  function PdfWriter() {
    const parts = []; let off = 0; const offsets = [];
    const push = (u8) => { parts.push(u8); off += u8.length; };
    const latin = str => { const u = new Uint8Array(str.length); for (let i = 0; i < str.length; i++) u[i] = str.charCodeAt(i) & 255; return u; };
    push(latin('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
    return {
      obj(id, body) { offsets[id] = off; push(latin(`${id} 0 obj\n${body}\nendobj\n`)); },
      raw(id, dict, bytes) { offsets[id] = off; push(latin(`${id} 0 obj\n${dict}\nstream\n`)); push(bytes); push(latin('\nendstream\nendobj\n')); },
      stream(id, content) {
        const raw = latin(content); const z = fflate.zlibSync(raw, { level: 6 });
        offsets[id] = off; push(latin(`${id} 0 obj\n<< /Length ${z.length} /Filter /FlateDecode >>\nstream\n`)); push(z); push(latin('\nendstream\nendobj\n'));
      },
      finish(rootId, maxId, info) {
        const xref = off; let x = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
        for (let i = 1; i <= maxId; i++) x += String(offsets[i] || 0).padStart(10, '0') + (offsets[i] ? ' 00000 n \n' : ' 00000 f \n');
        x += `trailer\n<< /Size ${maxId + 1} /Root ${rootId} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
        push(latin(x));
        return new Blob(parts, { type: 'application/pdf' });
      },
    };
  }

  // ---------- apertura ----------
  function openBook(files, wbPath, loc) {
    const book = readWorkbook(files, wbPath);
    book.fmt = makeFormatter(loc, book.date1904);
    book.sheetCache = new Map();
    return book;
  }
  function getSheet(book, files, path) {
    let sh = book.sheetCache.get(path);
    if (!sh) { sh = readSheet(files[path]); sh.images = readImages(files, path); book.sheetCache.set(path, sh); }
    return sh;
  }
  // ---------- imágenes de la hoja (añadido 2026-10-27: el logo de la carátula del formato de compras) ----------
  // Solo la esquina de anclaje y el tamaño (`ext`, en EMU); se ignoran recortes y giros.
  function readImages(files, path) {
    const relsPath = path.replace(/[^/]+$/, m => '_rels/' + m + '.rels');
    if (!files[relsPath]) return [];
    const out = [];
    for (const r of dec.decode(files[relsPath]).match(/<Relationship\b[^>]*>/g) || []) {
      if (!/\/drawing$/.test(attr(r, 'Type') || '')) continue;
      const dPath = resolve(path, attr(r, 'Target'));
      if (!files[dPath]) continue;
      const dxml = dec.decode(files[dPath]);
      const dRelsPath = dPath.replace(/[^/]+$/, m => '_rels/' + m + '.rels');
      const dRels = {};
      if (files[dRelsPath]) for (const q of dec.decode(files[dRelsPath]).match(/<Relationship\b[^>]*>/g) || []) dRels[attr(q, 'Id')] = resolve(dPath, attr(q, 'Target'));
      for (const m of dxml.matchAll(/<(?:\w+:)?(twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/(?:\w+:)?\1>/g)) {
        const a = m[0];
        const from = a.match(/<(?:\w+:)?from>([\s\S]*?)<\/(?:\w+:)?from>/); if (!from) continue;
        const v = t => +((from[1].match(new RegExp(`<(?:\\w+:)?${t}>(-?\\d+)<`)) || [])[1] || 0);
        const emb = (a.match(/r:embed="([^"]+)"/) || [])[1]; const media = emb && dRels[emb];
        const ext = a.match(/<(?:\w+:)?ext\s+cx="(\d+)"\s+cy="(\d+)"/);
        if (!media || !files[media] || !ext || !/\.(png|jpe?g|gif|bmp|webp)$/i.test(media)) continue;
        out.push({ c: v('col') + 1, r: v('row') + 1, dx: v('colOff') / 12700, dy: v('rowOff') / 12700, w: +ext[1] / 12700, h: +ext[2] / 12700, path: media });
      }
    }
    return out;
  }
  // Decodifica las imágenes una vez (en el navegador; sin `createImageBitmap` simplemente no se dibujan).
  async function prepareImages(book, files) {
    book.images = book.images || new Map();
    if (typeof createImageBitmap !== 'function') return;
    for (const sh of book.sheetCache.values()) for (const im of sh.images || []) {
      if (book.images.has(im.path)) continue;
      try { book.images.set(im.path, await createImageBitmap(new Blob([files[im.path]]))); } catch (e) { book.images.set(im.path, null); }
    }
  }
  // Píxeles RGB + alfa comprimidos para el PDF.
  function imagePdfData(bitmap) {
    const w = bitmap.width, h = bitmap.height;
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const g = cv.getContext('2d'); g.drawImage(bitmap, 0, 0);
    const px = g.getImageData(0, 0, w, h).data;
    const rgb = new Uint8Array(w * h * 3), alpha = new Uint8Array(w * h);
    for (let i = 0, j = 0, k = 0; i < px.length; i += 4) { rgb[j++] = px[i]; rgb[j++] = px[i + 1]; rgb[j++] = px[i + 2]; alpha[k++] = px[i + 3]; }
    return { w, h, rgb: fflate.zlibSync(rgb, { level: 6 }), alpha: fflate.zlibSync(alpha, { level: 6 }) };
  }
  // última fila con algún valor (ignora filas solo con formato)
  function lastValueRow(sh) {
    for (let k = sh.rIdx.length - 1; k >= 0; k--) {
      if (sh.rEnd[k] <= sh.rStart[k]) continue;
      const seg = dec.decode(sh.u8.subarray(sh.rStart[k], sh.rEnd[k]));
      if (/<(?:\w+:)?v>|<(?:\w+:)?is>/.test(seg)) return sh.rIdx[k];
    }
    return 1;
  }
  function lastColOf(sh) {
    if (sh.dim) { const r = parseRange(sh.dim); if (r.c2 < 16384) return r.c2; }
    return 26;
  }

  // ---------- plan de páginas ----------
  // fmt (opcional): formato preparado que reemplaza la configuración de página del archivo
  function planSheet(book, sh, sheet, fmt) {
    let S, area, titles = null;
    const nm = book.names.filter(n => n.sheet === String(sheet.index));
    if (fmt) {
      S = { paper: +fmt.paperSize, landscape: fmt.orientation === 'landscape', scale: 100, fitToPage: true, fitW: 1, fitH: fmt.fitToHeight || 0, overThenDown: false,
        m: { l: fmt.margins.left, r: fmt.margins.right, t: fmt.margins.top, b: fmt.margins.bottom, h: fmt.margins.header, f: fmt.margins.footer },
        header: fmt.pageNumbers ? '' : sh.setup.header, footer: fmt.pageNumbers ? '&CPágina &P de &N' : sh.setup.footer, hfScale: true, hCenter: false };
      titles = fmt.titleRows || null;
      area = { c1: fmt.colDesde ? colIdx(fmt.colDesde) : 1, r1: 1, c2: fmt.colHasta ? colIdx(fmt.colHasta) : lastColOf(sh), r2: lastValueRow(sh) };
    } else {
      S = sh.setup;
      const pa = nm.find(n => n.name === '_xlnm.Print_Area'), pt = nm.find(n => n.name === '_xlnm.Print_Titles');
      area = pa ? parseRange(pa.ref.split(',')[0].replace(/^.*!/, '')) : (sh.dim ? parseRange(sh.dim) : { c1: 1, r1: 1, c2: 1, r2: 1 });
      if (pt) for (const p of pt.ref.split(',')) { const m = /^(\d+):(\d+)$/.exec(p.replace(/^.*!/, '').replace(/\$/g, '')); if (m) titles = { from: +m[1], to: +m[2] }; }
    }
    const lastR = sh.rIdx.length ? sh.rIdx[sh.rIdx.length - 1] : 1;
    if (area.r2 > lastR) area.r2 = lastR;
    const colW = c => { const d = sh.cols.find(x => c >= x.min && c <= x.max); if (d && d.hidden) return 0; const w = d ? d.w : sh.defW; return Math.trunc(w * MDW + 5) * 0.75; };
    const cw = []; for (let c = area.c1; c <= area.c2; c++) cw[c] = colW(c);
    if (!sh.byR) { sh.byR = new Map(); sh.rIdx.forEach((r, k) => sh.byR.set(r, k)); }
    const rowsList = [];
    for (let r = area.r1; r <= area.r2; r++) { const k = sh.byR.get(r); const h = k == null ? sh.defH : sh.rH[k]; if (h > 0) rowsList.push({ r, k, h }); }
    const titleRows = titles ? rowsList.filter(x => x.r >= titles.from && x.r <= titles.to) : [];
    let [pw, ph] = PAPER[S.paper] || PAPER[1]; if (S.landscape) [pw, ph] = [ph, pw];
    const W = pw - (S.m.l + S.m.r) * 72, H = ph - (S.m.t + S.m.b) * 72;
    const areaW = cw.reduce((a, b) => a + (b || 0), 0);
    let scale;
    if (S.fitToPage) {
      const totalH = rowsList.reduce((a, x) => a + x.h, 0);
      const sw = S.fitW > 0 ? (W * S.fitW) / areaW : Infinity, shh = S.fitH > 0 ? (H * S.fitH) / totalH : Infinity;
      scale = Math.max(0.1, Math.floor(Math.min(1, sw, shh) * 100) / 100);
    } else scale = Math.min(4, Math.max(0.1, S.scale / 100));
    const colPages = []; let cur = [], wsum = 0;
    for (let c = area.c1; c <= area.c2; c++) {
      const w = cw[c] * scale;
      if (cur.length && (wsum + w > W + 0.01 || (!fmt && sh.colBreaks.has(c - 1)))) { colPages.push(cur); cur = []; wsum = 0; }
      cur.push(c); wsum += w;
    }
    if (cur.length) colPages.push(cur);
    const tH = titleRows.reduce((a, x) => a + x.h, 0) * scale;
    const rowPages = []; let pg = [], hsum = 0;
    const wantsTitles = x => !!(titles && titleRows.length && x.r > titles.to);
    for (const x of rowsList) {
      const h = x.h * scale;
      if (!pg.length) pg.withTitles = wantsTitles(x) && rowPages.length > 0;
      const cap = H - (pg.withTitles ? tH : 0);
      if (pg.length && (hsum + h > cap + 0.01 || sh.rowBreaks.has(x.r - 1))) { rowPages.push(pg); pg = []; hsum = 0; pg.withTitles = wantsTitles(x); }
      pg.push(x); hsum += h;
    }
    if (pg.length) rowPages.push(pg);
    const pages = [];
    if (S.overThenDown) { for (const rp of rowPages) for (const cp of colPages) pages.push({ rp, cp }); }
    else { for (const cp of colPages) for (const rp of rowPages) pages.push({ rp, cp }); }
    const P = { sheet, sh, S, pages, cw, titleRows, titles, scale, pw, ph, W, H, colPages, area, fontPt: 11 * scale };
    if (colPages.length > 1) {
      const cache = new Map();
      P.pages = P.pages.filter(pg2 => {
        const set = new Set(pg2.cp);
        return pg2.rp.some(x => { if (x.k == null) return false; let cells = cache.get(x.k); if (!cells) { cells = rowCells(sh, x.k, book, book.fmt); cache.set(x.k, cells); } return cells.some(c => c.val && set.has(c.c)); });
      });
      if (!P.pages.length) P.pages = pages.slice(0, 1);
    }
    const mergeAt = new Map(), covered = new Set();
    for (const m of sh.merges) { mergeAt.set(m.r1 + ':' + m.c1, m); for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) if (r !== m.r1 || c !== m.c1) covered.add(r + ':' + c); }
    P.mergeAt = mergeAt; P.covered = covered;
    return P;
  }

  // ---------- dibujo de una página (coordenadas en pt desde arriba a la izquierda) ----------
  // dev: { rect(x,y,w,h,rgb), text(str,font,size,tz,x,base,color,clip), line(w,x1,y1,x2,y2) }
  function drawPage(P, pi, dev, book, ctx) {
    const { sh, S, scale, cw } = P; const { rp, cp } = P.pages[pi];
    const ox = S.m.l * 72, oy = S.m.t * 72;
    const pageW = cp.reduce((a, c) => a + cw[c] * scale, 0);
    const xs = {}; let x = ox + (S.hCenter ? Math.max(0, (P.W - pageW) / 2) : 0); for (const c of cp) { xs[c] = x; x += cw[c] * scale; } const xEnd = x;
    const rows = rp.withTitles ? P.titleRows.concat(rp) : rp;
    let y = oy; const cpSet = new Set(cp); const borders = []; const rowTop = {};
    for (const rw of rows) {
      const h = rw.h * scale; const top = y, bot = y + h; y = bot;
      if (rowTop[rw.r] == null) rowTop[rw.r] = top;
      if (rw.k == null) continue;
      const cells = rowCells(sh, rw.k, book, book.fmt);
      const filled = new Set(); for (const c of cells) if (c.val) filled.add(c.c);
      for (const cell of cells) {
        if (!cpSet.has(cell.c)) continue;
        const xf = cell.xf; const cx = xs[cell.c]; let cwid = cw[cell.c] * scale;
        if (xf.fill && !(xf.fill[0] === 1 && xf.fill[1] === 1 && xf.fill[2] === 1)) dev.rect(cx, top, cwid, h, xf.fill);
        const b = xf.border;
        if (b.t) borders.push([b.t * scale, cx, top, cx + cwid, top]);
        if (b.b) borders.push([b.b * scale, cx, bot, cx + cwid, bot]);
        if (b.l) borders.push([b.l * scale, cx, top, cx, bot]);
        if (b.r) borders.push([b.r * scale, cx + cwid, top, cx + cwid, bot]);
        if (!cell.val || P.covered.has(rw.r + ':' + cell.c)) continue;
        const mg = P.mergeAt.get(rw.r + ':' + cell.c);
        if (mg) { cwid = 0; for (let c = mg.c1; c <= mg.c2; c++) if (cpSet.has(c)) cwid += cw[c] * scale; }
        const font = xf.font; const size = font.sz * scale; const tz = font.tz / 100;
        const v = cell.val; const pad = 1.5 * scale;
        let align = xf.h && xf.h !== 'general' ? xf.h : (cell.isNum ? 'right' : cell.bool || cell.err ? 'center' : 'left');
        if (align === 'centerContinuous') align = 'center';
        if (align === 'fill' || align === 'justify' || align === 'distributed') align = 'left';
        const color = v.color || font.color;
        const base = xf.v === 'top' ? top + size * 0.95 : xf.v === 'center' ? (top + bot) / 2 + size * 0.33 : bot - size * 0.22 - 0.6 * scale;
        const wOf = str => measure(win(str), font.fk) * size * tz;
        const put = (str, tx, clip, b2) => { if (str.trim()) dev.text(str, font.fk, size, tz, tx, b2 == null ? base : b2, color, clip ? [clip[0], top, clip[1] - clip[0], h] : null); };
        const hashes = () => { const hw = wOf('#'); const n = Math.max(1, Math.floor((cwid - pad) / hw)); put('#'.repeat(n), cx + (cwid - n * hw) / 2); };
        if (v.fill) {
          const left = v.left || '', right = v.text || ''; const total = wOf(left) + wOf(right);
          if (cell.isNum && total > cwid - pad) { hashes(); continue; }
          const clip = total > cwid ? [cx, cx + cwid] : null;
          put(left, cx + pad, clip); put(right, cx + cwid - pad - wOf(right), clip);
          continue;
        }
        const str = v.text; const tw = wOf(str);
        if (cell.isNum && tw > cwid - pad * 0.5) { hashes(); continue; }
        if (xf.wrap && !cell.isNum && tw > cwid - 2 * pad) {
          const words = str.split(/(\s+)/); const lines = []; let ln = '';
          for (const wd of words) { const t = ln + wd; if (wOf(t) > cwid - 2 * pad && ln.trim()) { lines.push(ln.trim()); ln = wd.trimStart(); } else ln = t; }
          if (ln.trim()) lines.push(ln.trim());
          const lh = size * 1.22; let ly = xf.v === 'top' ? 0 : xf.v === 'center' ? -((lines.length - 1) * lh) / 2 : -(lines.length - 1) * lh;
          for (const L of lines) { const lw = wOf(L); const tx = align === 'right' ? cx + cwid - pad - lw : align === 'center' ? cx + (cwid - lw) / 2 : cx + pad; put(L, tx, [cx, cx + cwid], base + ly); ly += lh; }
          continue;
        }
        let x0 = cx, x1 = cx + cwid;
        if (tw > cwid - 2 * pad && !mg) {
          if (align === 'left' || align === 'center') { let c = cell.c + 1; while (cpSet.has(c) && !filled.has(c) && (x1 - x0) < tw + 2 * pad) { x1 += cw[c] * scale; c++; } }
          if (align === 'right' || align === 'center') { let c = cell.c - 1; while (cpSet.has(c) && !filled.has(c) && (x1 - x0) < tw + 2 * pad) { x0 -= cw[c] * scale; c--; } }
        }
        const tx = align === 'right' ? cx + cwid - pad - tw : align === 'center' ? cx + (cwid - tw) / 2 : cx + pad;
        put(str, tx, tw > (x1 - x0) - pad ? [Math.max(x0, ox), Math.min(x1, xEnd)] : null);
      }
    }
    for (const bo of borders) dev.line(...bo);
    if (dev.image) for (const im of sh.images || []) {
      if (cpSet.has(im.c) && rowTop[im.r] != null) dev.image(im, xs[im.c] + im.dx * scale, rowTop[im.r] + im.dy * scale, im.w * scale, im.h * scale);
    }
    // encabezado y pie
    const pageNo = pi + 1, pageTot = P.pages.length;
    const sub = t => t.replace(/&&/g, '\u0001').replace(/&P/g, pageNo.toLocaleString('es-EC')).replace(/&N/g, pageTot.toLocaleString('es-EC')).replace(/&A/g, P.sheet.name).replace(/&F/g, ctx.fileName || '')
      .replace(/&D/g, new Date().toLocaleDateString('es-EC')).replace(/&T/g, new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })).replace(/&[A-Za-z]/g, '').replace(/\u0001/g, '&');
    const hfSize = 11 * (S.hfScale ? scale : 1); const hfFont = book.xfs[0].font; const hfTz = hfFont.tz / 100;
    const putHF = (code, base) => {
      if (!code) return; const sec = hfSections(code);
      for (const k of ['L', 'C', 'R']) {
        const t = sub(sec[k]); if (!t.trim()) continue;
        const tw = measure(win(t), 'R') * hfSize * hfTz;
        const tx = k === 'L' ? S.m.l * 72 : k === 'R' ? P.pw - S.m.r * 72 - tw : (P.pw - tw) / 2;
        dev.text(t, 'R', hfSize, hfTz, tx, base, null, null);
      }
    };
    putHF(S.header, S.m.h * 72 + hfSize * 0.8);
    putHF(S.footer, P.ph - S.m.f * 72 - hfSize * 0.25);
  }

  // ---------- salida PDF ----------
  async function renderPdf(files, { wbPath, sheets, fmt, fileName, loc, onProgress, book }) {
    book = book || openBook(files, wbPath, loc);
    const plans = [];
    for (const s of sheets) {
      onProgress && onProgress(`Preparando la hoja ${s.name}…`, 0); await new Promise(r => setTimeout(r, 0));
      plans.push(planSheet(book, getSheet(book, files, s.path), s, typeof fmt === 'function' ? fmt(s) : fmt));
    }
    const total = plans.reduce((a, p) => a + p.pages.length, 0);
    const pdf = PdfWriter();
    const FONTS = { R: 'Helvetica', B: 'Helvetica-Bold', I: 'Helvetica-Oblique', BI: 'Helvetica-BoldOblique' };
    const FID = { R: 'F1', B: 'F2', I: 'F3', BI: 'F4' };
    FONT_KEYS.forEach((k, i) => pdf.obj(3 + i, `<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS[k]} /Encoding /WinAnsiEncoding >>`));
    let nextId = 8; const kids = []; let done = 0;
    // Imágenes: una XObject por archivo (con su máscara de transparencia), compartida por todas las páginas.
    const imgIds = new Map();
    for (const P of plans) for (const im of P.sh.images || []) {
      const bm = book.images && book.images.get(im.path);
      if (!bm || imgIds.has(im.path)) continue;
      const d = imagePdfData(bm); const mid = nextId++, iid = nextId++;
      pdf.raw(mid, `<< /Type /XObject /Subtype /Image /Width ${d.w} /Height ${d.h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${d.alpha.length} >>`, d.alpha);
      pdf.raw(iid, `<< /Type /XObject /Subtype /Image /Width ${d.w} /Height ${d.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /SMask ${mid} 0 R /Filter /FlateDecode /Length ${d.rgb.length} >>`, d.rgb);
      imgIds.set(im.path, { id: iid, name: 'Im' + (imgIds.size + 1) });
    }
    const xobj = imgIds.size ? ` /XObject << ${[...imgIds.values()].map(v => `/${v.name} ${v.id} 0 R`).join(' ')} >>` : '';
    for (const P of plans) {
      const ph = P.ph;
      for (let pi = 0; pi < P.pages.length; pi++) {
        const ops = []; let lw = -1;
        const dev = {
          rect: (x, y, w, h, c) => ops.push(`${f2(c[0])} ${f2(c[1])} ${f2(c[2])} rg ${f2(x)} ${f2(ph - y - h)} ${f2(w)} ${f2(h)} re f 0 g`),
          text: (str, fk, size, tz, x, base, color, clip) => {
            let s = `BT /${FID[fk]} ${f2(size)} Tf ${tz !== 1 ? Math.round(tz * 100) + ' Tz ' : ''}${color ? `${f2(color[0])} ${f2(color[1])} ${f2(color[2])} rg ` : ''}${f2(x)} ${f2(ph - base)} Td ${pdfStr(win(str))} Tj ET`;
            if (color) s += ' 0 g';
            if (clip) s = `q ${f2(clip[0])} ${f2(ph - clip[1] - clip[3])} ${f2(clip[2])} ${f2(clip[3])} re W n ${s} Q`;
            ops.push(s);
          },
          line: (w, x1, y1, x2, y2) => { if (w !== lw) { ops.push(`${f2(w)} w`); lw = w; } ops.push(`${f2(x1)} ${f2(ph - y1)} m ${f2(x2)} ${f2(ph - y2)} l S`); },
          image: (im, x, y, w, h) => { const o = imgIds.get(im.path); if (o) ops.push(`q ${f2(w)} 0 0 ${f2(h)} ${f2(x)} ${f2(ph - y - h)} cm /${o.name} Do Q`); },
        };
        drawPage(P, pi, dev, book, { fileName });
        const cid = nextId++, pid = nextId++;
        pdf.stream(cid, ops.join('\n'));
        pdf.obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f2(P.pw)} ${f2(P.ph)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >>${xobj} >> /Contents ${cid} 0 R >>`);
        kids.push(pid); done++;
        if (done % 15 === 0) { onProgress && onProgress(`Generando PDF… página ${done.toLocaleString('es-EC')} de ${total.toLocaleString('es-EC')}`, done / total); await new Promise(r => setTimeout(r, 0)); }
      }
    }
    pdf.obj(2, `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(k => k + ' 0 R').join(' ')}] >>`);
    pdf.obj(1, `<< /Type /Catalog /Pages 2 0 R >>`);
    const infoId = nextId++;
    pdf.obj(infoId, `<< /Producer (Formatos de impresion) /Title ${pdfStr(win((fileName || '').replace(/\.xls[xm]$/i, '')))} >>`);
    onProgress && onProgress('Cerrando el PDF…', 1);
    return { blob: pdf.finish(1, infoId, infoId), pages: kids.length };
  }

  // ---------- vista previa en canvas ----------
  function drawCanvas(P, pi, canvas, cssWidth, book, ctx2) {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const k = cssWidth / P.pw; const cssH = P.ph * k;
    canvas.width = Math.round(cssWidth * dpr); canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssWidth + 'px'; canvas.style.height = cssH + 'px';
    const g = canvas.getContext('2d');
    g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, P.pw, P.ph);
    const FAM = 'Arial, Helvetica, "Liberation Sans", sans-serif';
    const css = c => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
    const dev = {
      rect: (x, y, w, h, c) => { g.fillStyle = css(c); g.fillRect(x, y, w, h); },
      text: (str, fk, size, tz, x, base, color, clip) => {
        g.save();
        if (clip) { g.beginPath(); g.rect(clip[0], clip[1], clip[2], clip[3]); g.clip(); }
        g.font = `${fk.includes('I') ? 'italic ' : ''}${fk.includes('B') ? 'bold ' : ''}${size}px ${FAM}`;
        g.fillStyle = color ? css(color) : '#000';
        g.translate(x, base); g.scale(tz, 1); g.fillText(str, 0, 0);
        g.restore();
      },
      line: (w, x1, y1, x2, y2) => { g.strokeStyle = '#000'; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); },
      image: (im, x, y, w, h) => { const bm = book.images && book.images.get(im.path); if (bm) g.drawImage(bm, x, y, w, h); },
    };
    drawPage(P, pi, dev, book, ctx2 || {});
  }

  function rowText(sh, k, book) { return rowCells(sh, k, book, book.fmt).map(c => c.val ? (c.val.left || '') + (c.val.text || '') : '').join(' '); }
  return { openBook, getSheet, prepareImages, planSheet, renderPdf, drawCanvas, lastValueRow, lastColOf, _rowText: rowText };
})();

// ===== Operaciones de la pantalla (lo que hacía el tercer <script>, sin tocar el DOM) =====
export const LOC = { dec: ',', thou: '.', date: 'd/m/yy' };

const unzipP = u8 => new Promise((res, rej) => { try { fflate.unzip(u8, (e, d) => e ? rej(e) : res(d)); } catch (e) { rej(e); } });
const zipP = obj => new Promise((res, rej) => { try { fflate.zip(obj, { level: 6 }, (e, d) => e ? rej(e) : res(d)); } catch (e) { rej(e); } });

/** Abre el .xlsx: descomprime, lista las hojas, indexa cada una y recomienda el formato. */
export async function abrirLibro(file, onPaso) {
  const tick = () => new Promise(r => setTimeout(r, 20));
  const u8 = new Uint8Array(await file.arrayBuffer());
  let files; try { files = await unzipP(u8); } catch { files = fflate.unzipSync(u8); }
  const info = PrintFix.listSheets(files);
  const ws = info.sheets.filter(s => s.isWorksheet);
  if (!ws.length) throw new Error('el libro no tiene hojas de cálculo');
  onPaso && onPaso('Leyendo estilos y textos…'); await tick();
  const book = XlsxPdf.openBook(files, info.wbPath, LOC);
  for (const s of ws) { onPaso && onPaso(`Indexando la hoja ${s.name}…`); await tick(); XlsxPdf.getSheet(book, files, s.path); }
  // detección del formato por el nombre de la primera hoja y el texto de sus 6 primeras filas
  const first = ws[0];
  const sh = XlsxPdf.getSheet(book, files, first.path);
  let text = '';
  try { for (let k = 0; k < Math.min(6, sh.rIdx.length); k++) text += ' ' + XlsxPdf._rowText(sh, k, book); } catch (e) {}
  // `detect.hojas`: el libro tiene una hoja que cumple cada patrón (pesa más que el texto).
  let recomendado = null, score = 0;
  for (const f of FORMATS) {
    let sc = 0;
    if (f.detect.sheet && f.detect.sheet.test(first.name)) sc += 1;
    if (f.detect.text && f.detect.text.test(text)) sc += 2;
    if (f.detect.hojas && f.detect.hojas.every(re => ws.some(s => re.test(s.name)))) sc += 4;
    if (sc > score) { score = sc; recomendado = f.id; }
  }
  await XlsxPdf.prepareImages(book, files);
  onPaso && onPaso('Calculando las páginas de cada formato…'); await tick();
  // Un plan por formato y por hoja (cada hoja con su configuración: `configDeHoja`).
  const planes = {};
  for (const fm of FORMATS) planes[fm.id] = ws.map(s => { const sh = XlsxPdf.getSheet(book, files, s.path); return XlsxPdf.planSheet(book, sh, s, configDeHoja(fm, s.name, sh, book)); });
  return { files, fileName: file.name, wbPath: info.wbPath, sheets: info.sheets, book, recomendado, planes };
}

/** El Excel con la impresión corregida: solo cambia la configuración de página. */
export async function excelCorregido(libro, fmt, sheets) {
  const out = { ...libro.files }; const info = [];
  for (const s of sheets) { const cfg = configDeHoja(fmt, s.name, XlsxPdf.getSheet(libro.book, libro.files, s.path), libro.book); const r = PrintFix.fixSheet(libro.files[s.path], cfg); out[s.path] = r.data; info.push({ ...s, cfg, lastRow: r.lastRow, lastCol: r.lastCol }); }
  // Una hoja cada vez: cada una lleva sus filas de títulos y su área (la carátula no repite filas).
  let wb = new TextDecoder().decode(libro.files[libro.wbPath]);
  for (const s of info) wb = PrintFix.fixWorkbook(wb, [s], s.cfg);
  out[libro.wbPath] = new TextEncoder().encode(wb);
  let z; try { z = await zipP(out); } catch { z = fflate.zipSync(out, { level: 6 }); }
  return new Blob([z], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function pdfDe(libro, fmt, sheets, onProgress) {
  return XlsxPdf.renderPdf(libro.files, { wbPath: libro.wbPath, sheets, fmt: s => configDeHoja(fmt, s.name, XlsxPdf.getSheet(libro.book, libro.files, s.path), libro.book), fileName: libro.fileName, loc: LOC, book: libro.book, onProgress });
}
