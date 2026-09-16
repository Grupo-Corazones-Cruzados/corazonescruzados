import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
  type ISectionOptions,
} from 'docx';
import type { Bloque, Celda, DocumentoPud, SemanaDoc } from '../tipos';
import { parsearEstrategias, lineas } from './estrategias';
import { celdaSemana, COLORES_FORMATO as C } from './documento';

/**
 * EL PUD EN WORD (.docx), a partir del MISMO modelo que el PDF y la vista previa
 * (`documento.ts`). Fernando (2026-09-16): «necesitamos una función para
 * descargar en Word, adicional a la opción de descargar PDF». La docente trabaja
 * el formato en Word: aquí la fila de una semana es una fila de tabla de verdad,
 * así que Word la parte entre páginas solo y repite la cabecera (`tableHeader`).
 *
 * Los colores son los del formato original (COLORES_FORMATO), no los del tema.
 */

const hex = (c: string) => c.replace('#', '').toUpperCase();
const ANCHO_PAGINA = 297 - 20; // A4 apaisado, márgenes de 10 mm
const TW = (mmv: number) => convertMillimetersToTwip(mmv);
const FUENTE = 'Arial';
const TAM = 15; // medios puntos: 7,5 pt
const TAM_ETIQUETA = 15;

const bordes = {
  top: { style: BorderStyle.SINGLE, size: 4, color: hex(C.borde) },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: hex(C.borde) },
  left: { style: BorderStyle.SINGLE, size: 4, color: hex(C.borde) },
  right: { style: BorderStyle.SINGLE, size: 4, color: hex(C.borde) },
};
const sinBordes = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};
const margenCelda = { top: 40, bottom: 40, left: 70, right: 70 };

const run = (texto: string, o: { negrita?: boolean; color?: string; tamano?: number } = {}) =>
  new TextRun({ text: texto, bold: o.negrita, color: o.color ? hex(o.color) : undefined, size: o.tamano ?? TAM, font: FUENTE });

/** Un párrafo por línea del texto (respeta los saltos). */
const parrafos = (texto: string, o: { negrita?: boolean; color?: string; tamano?: number; centrado?: boolean; despues?: number } = {}) =>
  (texto || '').split('\n').map(
    (l) =>
      new Paragraph({
        alignment: o.centrado ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: o.despues ?? 0, line: 240 },
        children: [run(l, o)],
      }),
  );

const esEnlace = (t: string) => /^https?:\/\/\S+$/.test(t.trim());
const parrafoEnlace = (url: string, sangria = 0) =>
  new Paragraph({
    indent: sangria ? { left: sangria } : undefined,
    spacing: { after: 0 },
    children: [new ExternalHyperlink({ link: url, children: [new TextRun({ text: url, style: 'Hyperlink', size: TAM, font: FUENTE, color: hex(C.fase), underline: {} })] })],
  });

function celda(c: Celda, anchoMm: number, extra: { tamano?: number } = {}): TableCell {
  const hijos = c.vinetas
    ? c.vinetas.map((v) => new Paragraph({ spacing: { after: 0 }, children: [run(`•  ${v}`, { tamano: extra.tamano })] }))
    : parrafos(c.texto, { negrita: c.etiqueta, tamano: c.etiqueta ? TAM_ETIQUETA : extra.tamano, centrado: c.centrado });
  return new TableCell({
    width: { size: TW(anchoMm), type: WidthType.DXA },
    borders: bordes,
    margins: margenCelda,
    verticalAlign: VerticalAlign.TOP,
    shading: c.etiqueta ? { type: ShadingType.CLEAR, fill: hex(C.etiqueta), color: 'auto' } : undefined,
    children: hijos.length ? hijos : [new Paragraph({ children: [run('')] })],
  });
}

/** Tabla de celdas con anchos en porcentaje del ancho útil. */
function tabla(filas: Celda[][], anchosPct?: number[], o: { tamano?: number; altoMinMm?: number } = {}): Table {
  const rows = filas.map((fila) => {
    const n = fila.length;
    const pct = anchosPct && anchosPct.length === n ? anchosPct : fila.map(() => 100 / n);
    return new TableRow({
      height: o.altoMinMm ? { value: TW(o.altoMinMm), rule: 'atLeast' } : undefined,
      children: fila.map((c, i) => celda(c, (ANCHO_PAGINA * pct[i]) / 100, { tamano: o.tamano })),
    });
  });
  const anchos = (anchosPct ?? filas[0].map(() => 100 / filas[0].length)).map((p) => TW((ANCHO_PAGINA * p) / 100));
  return new Table({ width: { size: TW(ANCHO_PAGINA), type: WidthType.DXA }, columnWidths: anchos, rows });
}

/** Barra de sección: una tabla de una celda con fondo rojo y texto blanco centrado. */
function barra(titulo: string, color: string, numero?: string, tamano = 17): Table {
  return new Table({
    width: { size: TW(ANCHO_PAGINA), type: WidthType.DXA },
    columnWidths: [TW(ANCHO_PAGINA)],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: TW(ANCHO_PAGINA), type: WidthType.DXA },
            borders: sinBordes,
            margins: { top: 30, bottom: 30, left: 70, right: 70 },
            shading: { type: ShadingType.CLEAR, fill: hex(color), color: 'auto' },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [run(`${numero ? numero + '  ' : ''}${titulo}`, { negrita: true, color: '#FFFFFF', tamano })] })],
          }),
        ],
      }),
    ],
  });
}

const hueco = (mmv = 2.5) => new Paragraph({ spacing: { before: 0, after: TW(mmv) / 1 }, children: [] });

// ── Imágenes ────────────────────────────────────────────────────────────────

const cacheImagenes = new Map<string, { datos: Buffer; tipo: 'png' | 'jpg' } | null>();
async function cargarImagen(url: string | null | undefined) {
  if (!url) return null;
  // Los iconos de las destrezas van como `data:` URL: se decodifican aquí mismo.
  const dataUrl = url.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
  if (dataUrl) return { datos: Buffer.from(dataUrl[2], 'base64'), tipo: (dataUrl[1] === 'png' ? 'png' : 'jpg') as 'png' | 'jpg' };
  if (cacheImagenes.has(url)) return cacheImagenes.get(url)!;
  let r: { datos: Buffer; tipo: 'png' | 'jpg' } | null = null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    const tipo = res.headers.get('content-type') ?? '';
    if (res.ok && /image\/(png|jpe?g)/.test(tipo)) r = { datos: Buffer.from(await res.arrayBuffer()), tipo: /png/.test(tipo) ? 'png' : 'jpg' };
  } catch {
    r = null;
  }
  cacheImagenes.set(url, r);
  return r;
}

/** Ancho y alto de un PNG (IHDR) o JPG (SOF), para no deformar las tiras de iconos. */
function medidas(d: { datos: Buffer; tipo: 'png' | 'jpg' }): { w: number; h: number } | null {
  const b = d.datos;
  if (d.tipo === 'png' && b.length > 24 && b.toString('ascii', 12, 16) === 'IHDR') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (d.tipo === 'jpg') {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marcador = b[i + 1];
      const largo = b.readUInt16BE(i + 2);
      if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + largo;
    }
  }
  return null;
}

/** La imagen a `altoPx` de alto, con su proporción (una tira de tres iconos es tres veces más ancha). */
const imagen = (d: { datos: Buffer; tipo: 'png' | 'jpg' }, altoPx: number, anchoMaxPx = 120) => {
  const m = medidas(d);
  const w = m ? Math.min(anchoMaxPx, Math.round((altoPx * m.w) / m.h)) : altoPx;
  const h = m ? Math.round((w * m.h) / m.w) : altoPx;
  return new Paragraph({ spacing: { after: 0 }, children: [new ImageRun({ type: d.tipo, data: d.datos, transformation: { width: w, height: h } })] });
};

// ── Cabecera ────────────────────────────────────────────────────────────────

async function cabecera(doc: DocumentoPud): Promise<(Table | Paragraph)[]> {
  const inst = doc.institucion;
  const logos: Paragraph[] = [];
  for (const url of inst.logos.slice(0, 3)) {
    const d = await cargarImagen(url);
    if (d) logos.push(new Paragraph({ spacing: { after: 0 }, children: [new ImageRun({ type: d.tipo, data: d.datos, transformation: { width: 60, height: 60 } })] }));
  }
  const centro = inst.cabecera.map(
    (l) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [run(l.texto, { negrita: l.estilo === 'grande', tamano: l.estilo === 'grande' ? 30 : l.estilo === 'acento' ? 22 : 20, color: l.estilo === 'acento' ? C.acentoCabecera : C.gris })],
      }),
  );
  const anchos = [58, ANCHO_PAGINA - 58 - 30, 30];
  const fila = new TableRow({
    children: [
      new TableCell({ width: { size: TW(anchos[0]), type: WidthType.DXA }, borders: bordes, margins: margenCelda, verticalAlign: VerticalAlign.CENTER, children: logos.length ? logos : [new Paragraph({ children: [run('')] })] }),
      new TableCell({ width: { size: TW(anchos[1]), type: WidthType.DXA }, borders: bordes, margins: margenCelda, verticalAlign: VerticalAlign.CENTER, children: centro }),
      new TableCell({
        width: { size: TW(anchos[2]), type: WidthType.DXA },
        borders: bordes,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, shading: { type: ShadingType.CLEAR, fill: hex(C.etiqueta), color: 'auto' }, spacing: { after: 60 }, children: [run('Año Lectivo', { negrita: true, tamano: 19 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [run(inst.anioLectivo, { tamano: 19 })] }),
        ],
      }),
    ],
  });
  return [
    new Table({ width: { size: TW(ANCHO_PAGINA), type: WidthType.DXA }, columnWidths: anchos.map(TW), rows: [fila] }),
    hueco(1.5),
    barra(doc.tituloDocumento, doc.colorCabecera, undefined, 24),
    hueco(),
  ];
}

// ── Bloques genéricos ───────────────────────────────────────────────────────

function bloque(b: Bloque, color: string): (Table | Paragraph)[] {
  const t = b.tipo === 'tabla' ? tabla(b.filas, b.anchos) : tabla([[{ texto: b.texto }]], [100], { altoMinMm: 9 });
  return [barra(b.titulo, color, b.numero), t, hueco()];
}

// ── La tabla de planificación ───────────────────────────────────────────────

const COLUMNAS = [8.5, 12.5, 12, 36, 14, 8.5, 8.5].map((p) => (ANCHO_PAGINA * p) / 100);

function celdaCabecera(texto: string, anchoMm: number, o: { colSpan?: number; rowSpan?: number } = {}) {
  return new TableCell({
    width: { size: TW(anchoMm), type: WidthType.DXA },
    borders: bordes,
    margins: margenCelda,
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: o.colSpan,
    rowSpan: o.rowSpan,
    shading: { type: ShadingType.CLEAR, fill: hex(C.cabeceraTabla), color: 'auto' },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [run(texto, { negrita: true })] })],
  });
}

function filasCabecera(): TableRow[] {
  const t = ['N.º de semana y Fecha', 'Temas / Contenidos', 'Destrezas con criterio de desempeño', 'Estrategias Metodológica', 'Recursos'];
  return [
    new TableRow({
      tableHeader: true,
      children: [...t.map((x, i) => celdaCabecera(x, COLUMNAS[i], { rowSpan: 2 })), celdaCabecera('Evaluación', COLUMNAS[5] + COLUMNAS[6], { colSpan: 2 })],
    }),
    new TableRow({ tableHeader: true, children: [celdaCabecera('Técnica', COLUMNAS[5]), celdaCabecera('Instrumento', COLUMNAS[6])] }),
  ];
}

/** El cuadro de una fase con las casillas I · R · A del DUA, como una tabla pequeña dentro de la celda. */
function fase(titulo: string): Table {
  const w = [58, 3.8, 3.8, 3.8];
  const casilla = (letra: string, color: string) =>
    new TableCell({
      width: { size: TW(3.8), type: WidthType.DXA },
      borders: sinBordes,
      margins: { top: 20, bottom: 20, left: 0, right: 0 },
      shading: { type: ShadingType.CLEAR, fill: hex(color), color: 'auto' },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [run(letra, { negrita: true, color: '#FFFFFF', tamano: 12 })] })],
    });
  return new Table({
    width: { size: TW(w.reduce((a, b) => a + b, 0)), type: WidthType.DXA },
    columnWidths: w.map(TW),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: TW(w[0]), type: WidthType.DXA },
            borders: bordes,
            margins: { top: 20, bottom: 20, left: 60, right: 60 },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ spacing: { after: 0 }, children: [run(titulo, { negrita: true, color: C.fase, tamano: 13 })] })],
          }),
          ...C.dua.map((d) => casilla(d.letra, d.color)),
        ],
      }),
    ],
  });
}

async function filaSemana(s: SemanaDoc): Promise<TableRow> {
  const cs = celdaSemana(s);
  const cel = (hijos: (Paragraph | Table)[], i: number) =>
    new TableCell({ width: { size: TW(COLUMNAS[i]), type: WidthType.DXA }, borders: bordes, margins: margenCelda, verticalAlign: VerticalAlign.TOP, children: hijos.length ? hijos : [new Paragraph({ children: [run('')] })] });

  const c0 = [...parrafos(cs.titulo, { negrita: true }), ...parrafos(cs.desde), ...parrafos(cs.hasta)];
  const c1 = [
    ...parrafos('Tema:', { negrita: true }),
    ...parrafos(s.tema ?? '', { despues: 160 }),
    ...parrafos('N.º de periodos:', { negrita: true }),
    ...parrafos(s.numeroPeriodos ?? '', { despues: 160 }),
    ...parrafos('Objetivos del tema:', { negrita: true }),
    ...parrafos(s.objetivosTema ?? ''),
  ];
  const c2: Paragraph[] = [];
  for (const d of s.destrezas) {
    c2.push(...parrafos(`${d.codigo} ${d.descripcion}`, { despues: 80 }));
    const img = await cargarImagen(d.imagenUrl);
    if (img) c2.push(imagen(img, 34));
    c2.push(hueco(1.5));
  }
  const c3: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [run('Ciclo de Aprendizaje: ACC', { negrita: true, tamano: 13 })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 60 }, children: [run('Enfoque: DUA', { negrita: true, tamano: 13 })] }),
  ];
  for (const f of parsearEstrategias(s.estrategias)) {
    if (f.titulo) {
      c3.push(fase(f.titulo));
      c3.push(hueco(1));
    }
    for (const a of f.actividades) {
      c3.push(esEnlace(a.texto) ? parrafoEnlace(a.texto) : new Paragraph({ spacing: { after: a.vinetas.length ? 0 : 80 }, children: [run(a.texto)] }));
      a.vinetas.forEach((v, i) =>
        c3.push(esEnlace(v) ? parrafoEnlace(v, TW(6)) : new Paragraph({ indent: { left: TW(6), hanging: TW(3) }, spacing: { after: i === a.vinetas.length - 1 ? 80 : 0 }, children: [run(`•  ${v}`)] })),
      );
    }
  }
  const c4 = lineas(s.recursos).flatMap((l) => parrafos(l));
  const c5 = lineas(s.tecnica).flatMap((l) => parrafos(l, { despues: 60 }));
  const c6 = lineas(s.instrumento).flatMap((l) => parrafos(l, { despues: 60 }));
  return new TableRow({ cantSplit: false, children: [cel(c0, 0), cel(c1, 1), cel(c2, 2), cel(c3, 3), cel(c4, 4), cel(c5, 5), cel(c6, 6)] });
}

async function tablaSemanas(doc: DocumentoPud): Promise<Table> {
  const rows = [...filasCabecera()];
  for (const s of doc.semanas) rows.push(await filaSemana(s));
  if (!doc.semanas.length)
    rows.push(new TableRow({ children: [new TableCell({ columnSpan: 7, borders: bordes, margins: margenCelda, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run('Todavía no hay planificaciones semanales generadas.')] })] })] }));
  return new Table({ width: { size: TW(ANCHO_PAGINA), type: WidthType.DXA }, columnWidths: COLUMNAS.map(TW), rows });
}

// ── Firmas ──────────────────────────────────────────────────────────────────

function firmas(doc: DocumentoPud): (Table | Paragraph)[] {
  const cols = doc.firmas.columnas;
  const pct = cols.map(() => 100 / cols.length);
  const salida: (Table | Paragraph)[] = [
    barra('FIRMAS DE RESPONSABILIDAD', doc.colorCabecera, `${doc.numeroFirmas}.`),
    tabla(
      [
        cols.map((c) => ({ texto: c.titulo, etiqueta: true, centrado: true })),
        cols.map((c) => ({ texto: `${c.cargo}    ${c.nombre}` })),
        cols.map(() => ({ texto: 'Firma:' })),
        cols.map((c) => ({ texto: `Fecha:    ${c.fecha}` })),
      ],
      pct,
      { altoMinMm: 7 },
    ),
    hueco(3),
  ];
  if (doc.registro) {
    const r = doc.registro;
    salida.push(...parrafos(r.titulo, { negrita: true, centrado: true, despues: 60 }));
    salida.push(
      tabla(
        [
          [{ texto: 'Elaborado por', etiqueta: true, centrado: true }, { texto: 'Aprobado por', etiqueta: true, centrado: true }],
          [{ texto: r.elaboradoPor.cargo, centrado: true }, { texto: r.aprobadoPor.cargo, centrado: true }],
          [{ texto: `\n\n${r.elaboradoPor.nombre}\nFecha: ${r.elaboradoPor.fecha}`, centrado: true }, { texto: `\n\n${r.aprobadoPor.nombre}\nFecha: ${r.aprobadoPor.fecha}`, centrado: true }],
        ],
        [50, 50],
      ),
    );
  }
  return salida;
}

// ── Punto de entrada ────────────────────────────────────────────────────────

export async function wordPud(doc: DocumentoPud): Promise<Buffer> {
  const hijos: (Table | Paragraph)[] = [];
  hijos.push(...(await cabecera(doc)));
  hijos.push(barra('DATOS INFORMATIVOS', doc.colorCabecera, '1.'));
  hijos.push(tabla([doc.datosInformativos[0]], [16, 34, 18, 32]));
  hijos.push(tabla([doc.datosInformativos[1]], [16, 34, 12, 20, 8, 10]));
  hijos.push(tabla([doc.datosInformativos[2]], [16, 66, 8, 10]));
  hijos.push(tabla([doc.datosInformativos[3]], [16, 10, 24, 50]));
  hijos.push(hueco());
  hijos.push(barra('TIEMPO', doc.colorCabecera, '2.'));
  hijos.push(tabla(doc.tiempo, [13, 7, 20, 7, 11, 7, 11, 24]));
  hijos.push(hueco());
  for (const b of doc.previos) hijos.push(...bloque(b, doc.colorCabecera));
  hijos.push(barra('PLANIFICACIÓN', doc.colorCabecera, `${doc.numeroPlanificacion}.`));
  hijos.push(await tablaSemanas(doc));
  hijos.push(hueco(3));
  for (const b of doc.posteriores) hijos.push(...bloque(b, doc.colorCabecera));
  hijos.push(...firmas(doc));

  const seccion: ISectionOptions = {
    properties: {
      page: {
        size: { orientation: PageOrientation.LANDSCAPE, width: TW(210), height: TW(297) },
        margin: { top: TW(10), bottom: TW(10), left: TW(10), right: TW(10) },
      },
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 13, font: FUENTE, color: '8A8A8A' })],
          }),
        ],
      }),
    },
    children: hijos,
  };

  const documento = new Document({
    creator: 'Planificación de Clases · Grupo Corazones Cruzados',
    title: doc.tituloDocumento,
    styles: { default: { document: { run: { font: FUENTE, size: TAM } } } },
    sections: [seccion],
  });
  return Packer.toBuffer(documento);
}
