import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import type { Bloque, Celda, DocumentoPud, SemanaDoc } from '../tipos';
import { parsearEstrategias, lineas } from './estrategias';
import { celdaSemana, COLORES_FORMATO } from './documento';

/**
 * EL PDF DEL PLAN DE UNIDAD DIDÁCTICA, dibujado con PDFKit (`standalone`, que
 * lleva las fuentes dentro: no lee archivos, que es lo que hace falta en un
 * contenedor). Es el motor probado en producción en la casa; el navegador de
 * puppeteer no está en el entorno.
 *
 * Lo difícil de este formato es la tabla de planificación: cada semana es una
 * fila de siete columnas que puede medir más que una página, y en el original
 * (Word) la fila se parte entre páginas. Aquí cada columna se convierte en una
 * lista de LÍNEAS ya partidas al ancho de su casilla (más imágenes y espacios), y
 * cada página consume de cada columna lo que quepa. Así una fila se parte donde
 * haga falta y la cabecera de la tabla se repite en cada página.
 *
 * ⚠️ Las imágenes entran como `data:` URL: `doc.image()` con un Buffer de Node
 * da 500 en esta versión (memoria de la casa).
 */

type Doc = InstanceType<typeof PDFDocument>;

const MM = 72 / 25.4;
const mm = (n: number) => n * MM;
const MARGEN = mm(10);

// Los colores son los del formato original, medidos sobre los PDF de ejemplo
// (ver COLORES_FORMATO en documento.ts). Nunca los del tema del inquilino.
const TEXTO = COLORES_FORMATO.texto;
const GRIS_ETIQUETA = COLORES_FORMATO.etiqueta;
const GRIS_CABECERA = COLORES_FORMATO.cabeceraTabla;
const BORDE = COLORES_FORMATO.borde;
const AZUL_FASE = COLORES_FORMATO.fase;
const BLANCO = '#ffffff';
const DUA = COLORES_FORMATO.dua;

const NEGRITA = 'Helvetica-Bold';
const NORMAL = 'Helvetica';
const TAM = 7.6;
const TAM_ETIQUETA = 7.4;

// ── Piezas del flujo de una casilla ─────────────────────────────────────────

type Linea = { tipo: 'linea'; texto: string; fuente: string; tamano: number; color: string; sangria: number; alto: number; enlace?: string };
type Espacio = { tipo: 'espacio'; alto: number };
type Imagen = { tipo: 'imagen'; datos: string; ancho: number; alto: number };
type Fase = { tipo: 'fase'; titulo: string; alto: number };
type Item = Linea | Espacio | Imagen | Fase;

const altoDe = (tamano: number) => tamano * 1.22;

/** Parte un texto en líneas que caben en `ancho` con la fuente dada. Cada línea es atómica al paginar. */
/**
 * Helvetica estándar no tiene emojis ni nada fuera de Latin-1: las caritas de la
 * docente (😀 😐 🙁) salían como «Ø=Þ». Se cambian por su palabra; lo demás que
 * no exista en la fuente se quita en vez de salir como basura.
 */
function apto(texto: string) {
  return texto
    .replace(/😀|😃|😄|🙂|😊/g, '(feliz)')
    .replace(/😐|😑/g, '(seria)')
    .replace(/🙁|☹️|😞|😢/g, '(triste)')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '');
}

function partir(doc: Doc, texto: string, ancho: number, fuente: string, tamano: number, color = TEXTO, sangria = 0, enlace?: string): Linea[] {
  texto = apto(texto);
  doc.font(fuente).fontSize(tamano);
  const util = ancho - sangria;
  const salida: Linea[] = [];
  for (const parrafo of texto.split('\n')) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (!palabras.length) {
      salida.push({ tipo: 'linea', texto: '', fuente, tamano, color, sangria, alto: altoDe(tamano) });
      continue;
    }
    let actual = '';
    const empujar = (l: string) => salida.push({ tipo: 'linea', texto: l, fuente, tamano, color, sangria, alto: altoDe(tamano), enlace });
    for (const p of palabras) {
      const candidata = actual ? `${actual} ${p}` : p;
      if (doc.widthOfString(candidata) <= util) {
        actual = candidata;
        continue;
      }
      if (actual) empujar(actual);
      // Una palabra más ancha que la casilla (un enlace largo) se parte por letras.
      if (doc.widthOfString(p) > util) {
        let trozo = '';
        for (const ch of p) {
          if (doc.widthOfString(trozo + ch) > util) {
            empujar(trozo);
            trozo = ch;
          } else trozo += ch;
        }
        actual = trozo;
      } else actual = p;
    }
    if (actual) empujar(actual);
  }
  return salida;
}

const espacio = (alto = mm(1.6)): Espacio => ({ tipo: 'espacio', alto });

/** Un párrafo de una casilla: etiqueta en negrita opcional + texto. */
function parrafo(doc: Doc, ancho: number, texto: string, o: { negrita?: boolean; sangria?: number; color?: string; tamano?: number } = {}): Item[] {
  return partir(doc, texto, ancho, o.negrita ? NEGRITA : NORMAL, o.tamano ?? TAM, o.color ?? TEXTO, o.sangria ?? 0);
}

const esEnlace = (t: string) => /^https?:\/\/\S+$/.test(t.trim());

// ── Imágenes remotas → data URL ─────────────────────────────────────────────

const cacheImagenes = new Map<string, string | null>();

async function cargarImagen(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  // Los iconos de las destrezas van como `data:` URL (PNG/JPG): PDFKit los dibuja tal cual.
  if (/^data:image\/(png|jpe?g);base64,/.test(url)) return url;
  if (cacheImagenes.has(url)) return cacheImagenes.get(url)!;
  let datos: string | null = null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    const tipo = r.headers.get('content-type') ?? '';
    // PDFKit solo entiende PNG y JPEG. Un logo en SVG o WEBP se omite, no rompe el documento.
    if (r.ok && /image\/(png|jpe?g)/.test(tipo)) {
      const b = Buffer.from(await r.arrayBuffer());
      datos = `data:${tipo.split(';')[0]};base64,${b.toString('base64')}`;
    }
  } catch {
    datos = null;
  }
  cacheImagenes.set(url, datos);
  return datos;
}

// ── El dibujante ────────────────────────────────────────────────────────────

class Dibujante {
  doc: Doc;
  x0: number;
  ancho: number;
  y: number;
  limite: number;
  constructor(doc: Doc) {
    this.doc = doc;
    this.x0 = MARGEN;
    this.ancho = doc.page.width - MARGEN * 2;
    this.y = MARGEN;
    this.limite = doc.page.height - MARGEN;
  }

  nuevaPagina() {
    this.doc.addPage();
    this.y = MARGEN;
  }

  asegurar(alto: number) {
    if (this.y + alto > this.limite) this.nuevaPagina();
  }

  /** Barra de sección: color de la institución, texto blanco centrado. */
  barra(titulo: string, color: string, numero?: string) {
    const h = mm(5.2);
    this.asegurar(h + mm(8));
    this.doc.rect(this.x0, this.y, this.ancho, h).fill(color);
    this.doc.fillColor(BLANCO).font(NEGRITA).fontSize(8.5).text(`${numero ? numero + '  ' : ''}${titulo}`, this.x0, this.y + mm(1.4), { width: this.ancho, align: 'center', lineBreak: false });
    this.y += h;
  }

  /**
   * Tabla de celdas de alto uniforme por fila (las de datos, tiempo, firmas…).
   * Una celda puede ser `etiqueta` (gris, negrita), `titulo` (rojo, blanco, negrita),
   * `cursiva`, llevar `vinetas` o una `imagen` (data URL) centrada bajo el texto.
   */
  tabla(filas: Celda[][], anchosPct?: number[], o: { tamano?: number; minAlto?: number } = {}) {
    const tam = o.tamano ?? TAM;
    const relleno = mm(1.4);
    const altoImagen = mm(11);
    for (const fila of filas) {
      const n = fila.length;
      const pct = anchosPct && anchosPct.length === n ? anchosPct : fila.map(() => 100 / n);
      const anchos = pct.map((p) => (this.ancho * p) / 100);
      const contenidos = fila.map((c, i) => {
        const w = anchos[i] - relleno * 2;
        const fuente = c.etiqueta || c.titulo ? NEGRITA : c.cursiva ? 'Helvetica-Oblique' : NORMAL;
        const items: Item[] = c.vinetas
          ? c.vinetas.flatMap((v) => partir(this.doc, `•  ${v}`, w, NORMAL, tam))
          : partir(this.doc, c.texto, w, fuente, c.etiqueta || c.titulo ? TAM_ETIQUETA : tam, c.titulo ? BLANCO : TEXTO);
        if (c.imagen) items.push(espacio(mm(1)), { tipo: 'imagen', datos: c.imagen, ancho: w, alto: altoImagen });
        return items;
      });
      const alto = Math.max(o.minAlto ?? mm(5.5), ...contenidos.map((it) => it.reduce((a, i) => a + i.alto, 0) + relleno * 2));
      this.asegurar(alto);
      let x = this.x0;
      fila.forEach((c, i) => {
        const w = anchos[i];
        if (c.etiqueta) this.doc.rect(x, this.y, w, alto).fill(GRIS_ETIQUETA);
        if (c.titulo) this.doc.rect(x, this.y, w, alto).fill(COLORES_FORMATO.barra);
        this.doc.rect(x, this.y, w, alto).lineWidth(0.5).strokeColor(BORDE).stroke();
        // Las celdas de título van centradas en vertical, como en el original.
        const altoContenido = contenidos[i].reduce((a, it) => a + it.alto, 0);
        let yy = this.y + (c.titulo ? (alto - altoContenido) / 2 : relleno);
        for (const it of contenidos[i]) {
          if (it.tipo === 'linea') {
            this.doc.fillColor(it.color).font(it.fuente).fontSize(it.tamano).text(it.texto, x + relleno + it.sangria, yy, { width: w - relleno * 2 - it.sangria, align: c.centrado || c.titulo ? 'center' : 'left', lineBreak: false });
          } else if (it.tipo === 'imagen') {
            // Centrada: se calcula el ancho que tendrá al ajustarse al alto.
            try {
              // `openImage` existe en PDFKit pero no en sus tipos: da el tamaño real para centrar.
              const img = (this.doc as unknown as { openImage: (src: string) => { width: number; height: number } }).openImage(it.datos);
              const escala = Math.min(it.alto / img.height, it.ancho / img.width);
              const wImg = img.width * escala;
              const hImg = img.height * escala;
              this.doc.image(it.datos, x + (w - wImg) / 2, yy + (it.alto - hImg) / 2, { width: wImg, height: hImg });
            } catch {
              /* imagen ilegible: se omite */
            }
          }
          yy += it.alto;
        }
        x += w;
      });
      this.y += alto;
    }
  }

  texto(t: string, o: { negrita?: boolean; tamano?: number; align?: 'left' | 'center' | 'right'; color?: string } = {}) {
    const lineasT = partir(this.doc, t, this.ancho, o.negrita ? NEGRITA : NORMAL, o.tamano ?? TAM, o.color ?? TEXTO);
    for (const l of lineasT) {
      this.asegurar(l.alto);
      this.doc.fillColor(l.color).font(l.fuente).fontSize(l.tamano).text(l.texto, this.x0, this.y, { width: this.ancho, align: o.align ?? 'left', lineBreak: false });
      this.y += l.alto;
    }
  }

  hueco(h: number) {
    this.y += h;
  }
}

// ── Cabecera de la primera página ───────────────────────────────────────────

async function cabecera(d: Dibujante, doc: DocumentoPud) {
  const inst = doc.institucion;
  const hCab = mm(17);
  const wLogos = mm(58);
  const wAnio = mm(30);
  const wCentro = d.ancho - wLogos - wAnio;
  const y = d.y;
  const pdf = d.doc;

  // Marco
  pdf.rect(d.x0, y, d.ancho, hCab).lineWidth(0.5).strokeColor(BORDE).stroke();
  pdf.moveTo(d.x0 + wLogos, y).lineTo(d.x0 + wLogos, y + hCab).stroke();
  pdf.moveTo(d.x0 + wLogos + wCentro, y).lineTo(d.x0 + wLogos + wCentro, y + hCab).stroke();

  // Logos, en fila
  let lx = d.x0 + mm(2);
  for (const url of inst.logos.slice(0, 3)) {
    const datos = await cargarImagen(url);
    if (!datos) continue;
    try {
      pdf.image(datos, lx, y + mm(2), { fit: [mm(17), hCab - mm(4)] });
    } catch {
      /* una imagen corrupta no tira el documento */
    }
    lx += mm(19);
  }

  // Centro: las líneas de la cabecera
  const lineasCab = inst.cabecera;
  const altos = lineasCab.map((l) => (l.estilo === 'grande' ? 14 : l.estilo === 'acento' ? 10 : 9.5));
  const total = altos.reduce((a, h) => a + h * 1.25, 0);
  let cy = y + (hCab - total) / 2;
  lineasCab.forEach((l, i) => {
    const grande = l.estilo === 'grande';
    pdf
      .fillColor(l.estilo === 'acento' ? COLORES_FORMATO.acentoCabecera : COLORES_FORMATO.gris)
      .font(grande ? NEGRITA : NORMAL)
      .fontSize(altos[i])
      .text(l.texto, d.x0 + wLogos, cy, { width: wCentro, align: 'center', lineBreak: false });
    cy += altos[i] * 1.25;
  });

  // Año lectivo
  const ax = d.x0 + wLogos + wCentro;
  pdf.rect(ax, y, wAnio, mm(6)).fill(GRIS_ETIQUETA);
  pdf.fillColor(TEXTO).font(NEGRITA).fontSize(9).text('Año Lectivo', ax, y + mm(1.6), { width: wAnio, align: 'center', lineBreak: false });
  pdf.font(NORMAL).fontSize(9).text(inst.anioLectivo, ax, y + mm(9.5), { width: wAnio, align: 'center', lineBreak: false });

  d.y = y + hCab + mm(1.5);

  // Título del documento
  const hT = mm(7);
  pdf.rect(d.x0, d.y, d.ancho, hT).fill(doc.colorCabecera);
  pdf.fillColor(BLANCO).font(NEGRITA).fontSize(12).text(doc.tituloDocumento, d.x0, d.y + mm(1.8), { width: d.ancho, align: 'center', lineBreak: false });
  d.y += hT + mm(2);
}

// ── Un bloque genérico (antes o después de la planificación) ────────────────

function bloque(d: Dibujante, b: Bloque, color: string) {
  // La barra va con su primera fila: una barra sola al pie de página es un título huérfano.
  d.asegurar(mm(5.2) + mm(16));
  const titulo = `${b.numero ? b.numero + '  ' : ''}${b.titulo}`;
  if (b.tipo === 'tabla') {
    d.barra(b.titulo, color, b.numero);
    d.tabla(b.filas, b.anchos, { minAlto: b.altoMinMm ? mm(b.altoMinMm) : undefined });
  } else if (b.tipo === 'texto') {
    d.barra(b.titulo, color, b.numero);
    d.tabla([[{ texto: b.texto }]], [100], { minAlto: mm(9) });
  } else if (b.tipo === 'lateral') {
    // Celda roja de título a la izquierda + una columna por competencia/inserción:
    // etiqueta gris arriba y el icono debajo, como en el original.
    const n = b.columnas.length;
    const anchos = [16, ...b.columnas.map(() => 84 / n)];
    d.tabla([[{ texto: titulo, titulo: true }, ...b.columnas.map((c) => ({ texto: c.texto, etiqueta: true, centrado: true, imagen: c.icono }))]], anchos, { minAlto: mm(22) });
  } else {
    d.tabla([[{ texto: titulo, titulo: true }, { texto: b.texto }]], [16, 84], { minAlto: mm(b.altoMinMm ?? 7) });
  }
  d.hueco(mm(2.5));
}

// ── La tabla de planificación (una fila por semana, partible entre páginas) ──

const COLUMNAS = [
  { titulo: 'N.º de semana y Fecha', pct: 8.5 },
  { titulo: 'Temas / Contenidos', pct: 12.5 },
  { titulo: 'Destrezas con criterio de desempeño', pct: 12 },
  { titulo: 'Estrategias Metodológica', pct: 36 },
  { titulo: 'Recursos', pct: 14 },
  { titulo: 'Técnica', pct: 8.5 },
  { titulo: 'Instrumento', pct: 8.5 },
];

function cabeceraTabla(d: Dibujante) {
  const h = mm(9);
  d.asegurar(h + mm(12));
  let x = d.x0;
  const pdf = d.doc;
  const anchos = COLUMNAS.map((c) => (d.ancho * c.pct) / 100);
  // «Evaluación» agrupa a técnica e instrumento.
  const xEval = d.x0 + anchos.slice(0, 5).reduce((a, w) => a + w, 0);
  const wEval = anchos[5] + anchos[6];
  pdf.rect(d.x0, d.y, d.ancho, h).fill(GRIS_CABECERA);
  COLUMNAS.forEach((c, i) => {
    const w = anchos[i];
    if (i < 5) {
      pdf.rect(x, d.y, w, h).lineWidth(0.5).strokeColor(BORDE).stroke();
      pdf.fillColor(TEXTO).font(NEGRITA).fontSize(7.6).text(c.titulo, x + mm(1), d.y + mm(2.2), { width: w - mm(2), align: 'center' });
    }
    x += w;
  });
  pdf.rect(xEval, d.y, wEval, h / 2).stroke();
  pdf.fillColor(TEXTO).font(NEGRITA).fontSize(7.6).text('Evaluación', xEval, d.y + mm(1.2), { width: wEval, align: 'center', lineBreak: false });
  pdf.rect(xEval, d.y + h / 2, anchos[5], h / 2).stroke();
  pdf.rect(xEval + anchos[5], d.y + h / 2, anchos[6], h / 2).stroke();
  pdf.text('Técnica', xEval, d.y + h / 2 + mm(1.2), { width: anchos[5], align: 'center', lineBreak: false });
  pdf.text('Instrumento', xEval + anchos[5], d.y + h / 2 + mm(1.2), { width: anchos[6], align: 'center', lineBreak: false });
  d.y += h;
}

/** El contenido de las siete casillas de una semana, ya partido en líneas. */
async function contenidoSemana(d: Dibujante, s: SemanaDoc, anchos: number[]): Promise<Item[][]> {
  const pdf = d.doc;
  const relleno = mm(1.4);
  const w = anchos.map((a) => a - relleno * 2);
  const cs = celdaSemana(s);

  const col0: Item[] = [...parrafo(pdf, w[0], cs.titulo, { negrita: true }), ...parrafo(pdf, w[0], cs.desde), ...parrafo(pdf, w[0], cs.hasta)];

  const col1: Item[] = [
    ...parrafo(pdf, w[1], 'Tema:', { negrita: true }),
    ...parrafo(pdf, w[1], s.tema ?? ''),
    espacio(mm(3)),
    ...parrafo(pdf, w[1], 'N.º de periodos:', { negrita: true }),
    ...parrafo(pdf, w[1], s.numeroPeriodos ?? ''),
    espacio(mm(3)),
    ...parrafo(pdf, w[1], 'Objetivos del tema:', { negrita: true }),
    ...parrafo(pdf, w[1], s.objetivosTema ?? ''),
  ];

  const col2: Item[] = [];
  for (const [i, dz] of s.destrezas.entries()) {
    if (i) col2.push(espacio(mm(3)));
    col2.push(...parrafo(pdf, w[2], `${dz.codigo} ${dz.descripcion}`));
    const datos = await cargarImagen(dz.imagenUrl);
    if (datos) {
      col2.push(espacio(mm(1)));
      // Tira de iconos: se ajusta a 9 mm de alto y al ancho de la casilla, sin deformar.
      col2.push({ tipo: 'imagen', datos, ancho: w[2], alto: mm(9) });
    }
  }

  const col3: Item[] = [];
  const fases = parsearEstrategias(s.estrategias);
  col3.push(...partir(pdf, 'Ciclo de Aprendizaje: ACC', w[3], NEGRITA, 6.8, TEXTO, w[3] * 0.62));
  col3.push(...partir(pdf, 'Enfoque: DUA', w[3], NEGRITA, 6.8, TEXTO, w[3] * 0.62));
  for (const f of fases) {
    col3.push(espacio(mm(2)));
    if (f.titulo) col3.push({ tipo: 'fase', titulo: f.titulo, alto: mm(6) });
    col3.push(espacio(mm(1.5)));
    for (const a of f.actividades) {
      if (esEnlace(a.texto)) col3.push(...partir(pdf, a.texto, w[3], NORMAL, TAM, AZUL_FASE, 0, a.texto));
      else col3.push(...parrafo(pdf, w[3], a.texto));
      for (const vi of a.vinetas) {
        if (esEnlace(vi)) col3.push(...partir(pdf, vi, w[3], NORMAL, TAM, AZUL_FASE, mm(6), vi));
        else col3.push(...parrafo(pdf, w[3], `•  ${vi}`, { sangria: mm(6) }));
      }
      col3.push(espacio(mm(1.8)));
    }
  }

  const col4: Item[] = lineas(s.recursos).flatMap((l) => parrafo(pdf, w[4], l));
  const col5: Item[] = lineas(s.tecnica).flatMap((l) => [...parrafo(pdf, w[5], l), espacio(mm(1))]);
  const col6: Item[] = lineas(s.instrumento).flatMap((l) => [...parrafo(pdf, w[6], l), espacio(mm(1))]);

  return [col0, col1, col2, col3, col4, col5, col6];
}

function dibujarItem(d: Dibujante, it: Item, x: number, y: number, w: number) {
  const pdf = d.doc;
  if (it.tipo === 'linea') {
    pdf.fillColor(it.color).font(it.fuente).fontSize(it.tamano);
    const opciones: Record<string, unknown> = { width: w - it.sangria, lineBreak: false };
    if (it.enlace) {
      opciones.link = it.enlace;
      opciones.underline = true;
    }
    pdf.text(it.texto, x + it.sangria, y, opciones);
  } else if (it.tipo === 'imagen') {
    try {
      pdf.image(it.datos, x, y, { fit: [it.ancho, it.alto] });
    } catch {
      /* imagen ilegible: se omite */
    }
  } else if (it.tipo === 'fase') {
    // Cuadro con el título de la fase y las tres casillas I · R · A del DUA.
    const wBadges = mm(12);
    const wTit = Math.min(w - wBadges - mm(1), mm(58));
    pdf.rect(x, y, wTit, it.alto).lineWidth(0.5).strokeColor(BORDE).stroke();
    pdf.fillColor(AZUL_FASE).font(NEGRITA).fontSize(6.4).text(it.titulo, x + mm(1.2), y + mm(1.9), { width: wTit - mm(2), lineBreak: false, ellipsis: true });
    let bx = x + wTit + mm(0.8);
    for (const b of DUA) {
      pdf.rect(bx, y, mm(3.6), it.alto).fill(b.color);
      pdf.fillColor(BLANCO).font(NEGRITA).fontSize(6).text(b.letra, bx, y + mm(1.9), { width: mm(3.6), align: 'center', lineBreak: false });
      bx += mm(3.7);
    }
  }
}

/** Dibuja todas las semanas, partiendo cada fila entre páginas cuando no cabe. */
async function tablaSemanas(d: Dibujante, doc: DocumentoPud) {
  const anchos = COLUMNAS.map((c) => (d.ancho * c.pct) / 100);
  const relleno = mm(1.4);
  cabeceraTabla(d);

  for (const s of doc.semanas) {
    const columnas = await contenidoSemana(d, s, anchos);
    const indices = columnas.map(() => 0);
    let primeraPorcion = true;
    while (indices.some((i, c) => i < columnas[c].length)) {
      // Si queda muy poco sitio, mejor empezar la porción en la página siguiente.
      if (d.y + mm(16) > d.limite) {
        d.nuevaPagina();
        cabeceraTabla(d);
      }
      const disponible = d.limite - d.y - relleno * 2;
      // Cada columna consume lo que quepa; una fila recién empezada garantiza al
      // menos un ítem por columna para no quedarse en bucle.
      let altoPorcion = 0;
      const tramos = columnas.map((col, c) => {
        let alto = 0;
        let fin = indices[c];
        while (fin < col.length && alto + col[fin].alto <= disponible) alto += col[fin++].alto;
        if (fin === indices[c] && fin < col.length && alto === 0 && col[fin].alto > disponible) fin++; // un ítem más alto que la página: se dibuja igual
        altoPorcion = Math.max(altoPorcion, alto);
        return fin;
      });
      const quedan = columnas.some((col, c) => tramos[c] < col.length);
      const alto = Math.max(mm(10), altoPorcion + relleno * 2);

      let x = d.x0;
      columnas.forEach((col, c) => {
        const w = anchos[c];
        d.doc.rect(x, d.y, w, alto).lineWidth(0.5).strokeColor(BORDE).stroke();
        let yy = d.y + relleno;
        for (let i = indices[c]; i < tramos[c]; i++) {
          dibujarItem(d, col[i], x + relleno, yy, w - relleno * 2);
          yy += col[i].alto;
        }
        x += w;
      });
      // Marca visual de continuación cuando la fila sigue en la página siguiente.
      if (quedan) {
        d.doc.fillColor('#8a8a8a').font(NORMAL).fontSize(6).text('(continúa)', d.x0, d.y + alto - mm(3), { width: anchos[0], align: 'center', lineBreak: false });
      }
      d.y += alto;
      for (let c = 0; c < indices.length; c++) indices[c] = tramos[c];
      if (quedan) {
        d.nuevaPagina();
        cabeceraTabla(d);
      }
      primeraPorcion = false;
    }
    void primeraPorcion;
  }
  if (!doc.semanas.length) {
    d.tabla([[{ texto: 'Todavía no hay planificaciones semanales generadas.', centrado: true }]], [100], { minAlto: mm(10) });
  }
}

// ── Firmas ──────────────────────────────────────────────────────────────────

function firmas(d: Dibujante, doc: DocumentoPud, numero: string) {
  d.asegurar(mm(60));
  d.barra('FIRMAS DE RESPONSABILIDAD', doc.colorCabecera, numero);
  const cols = doc.firmas.columnas;
  // Tres columnas; dentro de cada una, una casilla gris de etiqueta (Docente/s ·
  // Coordinador de área · Rector/Vicerrector, Firma, Fecha) y su valor, como el original.
  const anchos = cols.flatMap(() => [8, 100 / cols.length - 8]);
  d.tabla([cols.map((c) => ({ texto: c.titulo, etiqueta: true, centrado: true }))], cols.map(() => 100 / cols.length));
  d.tabla([cols.flatMap((c) => [{ texto: c.cargo, etiqueta: true }, { texto: c.nombre, cursiva: true }])], anchos, { minAlto: mm(7) });
  d.tabla([cols.flatMap(() => [{ texto: 'Firma:', etiqueta: true }, { texto: '' }])], anchos, { minAlto: mm(14) });
  d.tabla([cols.flatMap((c) => [{ texto: 'Fecha:', etiqueta: true }, { texto: c.fecha }])], anchos, { minAlto: mm(6) });
  d.hueco(mm(3));

  // «REGISTRO DE FORMATO»: media página a la izquierda, con su barra roja.
  const r = doc.registro;
  const anchoTotal = d.ancho;
  d.ancho = anchoTotal / 2;
  d.asegurar(mm(40));
  d.tabla([[{ texto: `REGISTRO DE FORMATO: ${r.titulo}`, titulo: true }]], [100], { minAlto: mm(6) });
  d.tabla([[{ texto: 'Elaborado por', etiqueta: true, centrado: true }, { texto: 'Aprobado por', etiqueta: true, centrado: true }]], [50, 50]);
  d.tabla([[{ texto: r.elaboradoPor.cargo, centrado: true }, { texto: r.aprobadoPor.cargo, centrado: true }]], [50, 50]);
  d.tabla([[{ texto: '' }, { texto: '' }]], [50, 50], { minAlto: mm(9) });
  d.tabla([[{ texto: r.elaboradoPor.nombre, centrado: true, cursiva: true }, { texto: r.aprobadoPor.nombre, centrado: true, cursiva: true }]], [50, 50]);
  d.tabla([[{ texto: 'Fecha:', etiqueta: true }, { texto: r.elaboradoPor.fecha, centrado: true }, { texto: 'Fecha:', etiqueta: true }, { texto: r.aprobadoPor.fecha, centrado: true }]], [14, 36, 14, 36]);
  d.ancho = anchoTotal;
}

// ── Punto de entrada ────────────────────────────────────────────────────────

export async function pdfPud(doc: DocumentoPud): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN },
    bufferPages: true,
    info: { Title: doc.tituloDocumento, Creator: 'Planificación de Clases · Grupo Corazones Cruzados' },
  });
  const d = new Dibujante(pdf);

  await cabecera(d, doc);
  d.barra('DATOS INFORMATIVOS', doc.colorCabecera, '1.');
  d.tabla([doc.datosInformativos[0]], [16, 34, 18, 32]);
  d.tabla([doc.datosInformativos[1]], [16, 34, 12, 20, 8, 10]);
  d.tabla([doc.datosInformativos[2]], [16, 66, 8, 10]);
  d.tabla([doc.datosInformativos[3]], [16, 10, 24, 50]);
  d.hueco(mm(2.5));
  d.barra('TIEMPO', doc.colorCabecera, '2.');
  d.tabla(doc.tiempo, [13, 7, 20, 7, 11, 7, 11, 24]);
  d.hueco(mm(2.5));

  for (const b of doc.previos) bloque(d, b, doc.colorCabecera);

  d.asegurar(mm(5.2) + mm(9) + mm(30));
  d.barra('PLANIFICACIÓN', doc.colorCabecera, `${doc.numeroPlanificacion}.`);
  await tablaSemanas(d, doc);
  d.hueco(mm(3));

  for (const b of doc.posteriores) bloque(d, b, doc.colorCabecera);
  firmas(d, doc, `${doc.numeroFirmas}.`);

  // Pie: numeración. ⚠️ Sin `width`/`align`: con ellos PDFKit entra por el
  // ajustador de líneas aunque se pida `lineBreak: false`, y como el pie está
  // por debajo del margen inferior, AÑADE UNA PÁGINA EN BLANCO por cada pie (se
  // midió: 4 páginas de más en un documento de 4). La alineación a la derecha
  // se calcula a mano.
  const paginas = pdf.bufferedPageRange();
  for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
    pdf.switchToPage(i);
    const texto = `${i - paginas.start + 1} / ${paginas.count}`;
    pdf.fillColor('#8a8a8a').font(NORMAL).fontSize(6.5);
    pdf.text(texto, pdf.page.width - MARGEN - pdf.widthOfString(texto), pdf.page.height - MARGEN + mm(2), { lineBreak: false });
  }

  return new Promise((resolve, reject) => {
    const trozos: Buffer[] = [];
    pdf.on('data', (c: Buffer) => trozos.push(c));
    pdf.on('end', () => resolve(Buffer.concat(trozos)));
    pdf.on('error', reject);
    pdf.end();
  });
}
