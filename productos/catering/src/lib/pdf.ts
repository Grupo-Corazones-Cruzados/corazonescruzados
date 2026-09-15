import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import type { TipoComida } from '@/generated/prisma/enums';
import { ETIQUETA_COMIDA, COLOR_COMIDA, ETIQUETA_DIA, ETIQUETA_GENERO, ETIQUETA_ACTIVIDAD, RESTRICCIONES_DESPACHO, ETIQUETA_ESTADO_CLIENTE } from '@/lib/catalogo';
import { fechaCorta, fechaLarga, type Dia } from '@/lib/fechas';
import type { DiaDeDespacho, Entrega } from '@/lib/despacho';
import { porMotorizado } from '@/lib/despacho';
import { ETIQUETA_SITUACION, type ResumenServicio } from '@/lib/servicios';

/**
 * LOS PDF DEL PRODUCTO. Lo que se imprime no se imprime «la página»: se genera un
 * documento con su diseño y se descarga (Fernando, 2026-09-15; es lo que hacía el
 * proyecto de referencia con jsPDF en el navegador). Aquí se hace en el servidor con
 * PDFKit —el mismo que usa la plataforma— porque los datos ya están ahí
 * (`calcularDia`) y así no hay que mandarlos al navegador para volver a dibujarlos.
 *
 * `pdfkit.standalone` lleva las fuentes estándar dentro: no lee archivos, que es lo
 * que hace falta en un contenedor. Helvetica cubre el español (acentos, ñ, «»).
 */

type Doc = InstanceType<typeof PDFDocument>;
type Negocio = { nombre: string; colorAcento: string };

const MM = 72 / 25.4;
const mm = (n: number) => n * MM;

const GRIS = '#616161';
const TEXTO = '#242424';
const BORDE = '#d0d0d0';
const REALCE = '#f3f2f1';
const ROJO = '#c42b1c';
const NARANJA = '#ca5010';

function crear(opciones: { size?: string; layout?: 'portrait' | 'landscape'; margen?: number } = {}) {
  const doc = new PDFDocument({
    size: opciones.size ?? 'A4',
    layout: opciones.layout ?? 'portrait',
    margins: { top: opciones.margen ?? mm(12), bottom: opciones.margen ?? mm(12), left: opciones.margen ?? mm(12), right: opciones.margen ?? mm(12) },
    bufferPages: true,
    info: { Creator: 'Gestión de Catering · Grupo Corazones Cruzados' },
  });
  return doc;
}

function terminar(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const trozos: Buffer[] = [];
    doc.on('data', (c: Buffer) => trozos.push(c));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);
    doc.end();
  });
}

/** Cabecera de página: negocio a la izquierda, título y subtítulo. Devuelve la y donde sigue el contenido. */
function cabecera(doc: Doc, negocio: Negocio, titulo: string, subtitulo: string) {
  const x = doc.page.margins.left;
  const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.page.margins.top;
  doc.rect(x, y, mm(1.5), mm(12)).fill(negocio.colorAcento);
  doc.fillColor(GRIS).font('Helvetica').fontSize(8).text(negocio.nombre.toUpperCase(), x + mm(4), y, { width: ancho, characterSpacing: 0.5 });
  doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(15).text(titulo, x + mm(4), y + mm(3.5), { width: ancho });
  doc.fillColor(GRIS).font('Helvetica').fontSize(9).text(subtitulo, x + mm(4), y + mm(9.5), { width: ancho });
  doc.moveTo(x, y + mm(15)).lineTo(x + ancho, y + mm(15)).lineWidth(0.6).strokeColor(TEXTO).stroke();
  return y + mm(19);
}

/** Pie en todas las páginas: producto y numeración. */
function pies(doc: Doc, texto: string) {
  const paginas = doc.bufferedPageRange();
  for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - doc.page.margins.bottom + mm(3);
    doc.fillColor(GRIS).font('Helvetica').fontSize(7);
    doc.text(texto, doc.page.margins.left, y, { lineBreak: false });
    doc.text(`${i - paginas.start + 1} / ${paginas.count}`, doc.page.margins.left, y, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'right', lineBreak: false });
  }
}

type Columna = { titulo: string; ancho: number; alinear?: 'left' | 'right' | 'center' };

/**
 * Una tabla sencilla con filas de alto variable y salto de página que repite la
 * cabecera. Las celdas son texto; `negrita` marca la columna que va en negrita.
 */
function tabla(doc: Doc, y: number, columnas: Columna[], filas: string[][], opciones: { negrita?: number; tamano?: number; casilla?: number; alFinalDePagina?: () => number } = {}) {
  const x0 = doc.page.margins.left;
  const tam = opciones.tamano ?? 8.5;
  const relleno = mm(1.8);
  const limite = doc.page.height - doc.page.margins.bottom;

  const cabeceraTabla = () => {
    let x = x0;
    doc.rect(x0, y, columnas.reduce((a, c) => a + c.ancho, 0), mm(6)).fill(REALCE);
    doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(7);
    for (const c of columnas) {
      doc.text(c.titulo.toUpperCase(), x + relleno, y + mm(2), { width: c.ancho - relleno * 2, align: c.alinear ?? 'left', lineBreak: false, ellipsis: true, height: mm(4) });
      x += c.ancho;
    }
    y += mm(6);
  };
  cabeceraTabla();

  for (const fila of filas) {
    doc.fontSize(tam);
    const alto = Math.max(mm(6), ...fila.map((celda, i) => {
      doc.font(i === opciones.negrita ? 'Helvetica-Bold' : 'Helvetica');
      return doc.heightOfString(celda || ' ', { width: columnas[i].ancho - relleno * 2 }) + relleno * 2;
    }));
    if (y + alto > limite) {
      doc.addPage();
      y = opciones.alFinalDePagina ? opciones.alFinalDePagina() : doc.page.margins.top;
      cabeceraTabla();
    }
    let x = x0;
    fila.forEach((celda, i) => {
      if (i === opciones.casilla) {
        // Una casilla para marcar a mano («entregado»).
        doc.rect(x + columnas[i].ancho / 2 - mm(2), y + relleno, mm(4), mm(4)).lineWidth(0.5).strokeColor(TEXTO).stroke();
      } else {
        doc.fillColor(TEXTO).font(i === opciones.negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(tam);
        doc.text(celda, x + relleno, y + relleno, { width: columnas[i].ancho - relleno * 2, align: columnas[i].alinear ?? 'left' });
      }
      x += columnas[i].ancho;
    });
    doc.moveTo(x0, y + alto).lineTo(x0 + columnas.reduce((a, c) => a + c.ancho, 0), y + alto).lineWidth(0.3).strokeColor(BORDE).stroke();
    y += alto;
  }
  return y;
}

// ─────────────────────────────────────────────────────────────────────────────
// Etiquetas: 10 × 7 cm, dos columnas y cuatro filas por hoja A4, por motorizado
// ─────────────────────────────────────────────────────────────────────────────

const ANCHO_ETIQUETA = mm(96);
const ALTO_ETIQUETA = mm(66);

function dibujarEtiqueta(doc: Doc, x: number, y: number, e: Entrega, comida: TipoComida, dia: Dia) {
  const w = ANCHO_ETIQUETA, h = ALTO_ETIQUETA;
  const c = e.cliente;
  doc.roundedRect(x, y, w, h, 3).lineWidth(0.5).strokeColor('#8a8886').stroke();

  // Banda de la comida
  doc.save().roundedRect(x, y, w, mm(9), 3).clip();
  doc.rect(x, y, w, mm(9)).fill(COLOR_COMIDA[comida]);
  doc.restore();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13).text(ETIQUETA_COMIDA[comida].toUpperCase(), x + mm(3), y + mm(2.6), { width: w - mm(6), lineBreak: false, characterSpacing: 0.8 });
  if (e.comidas.length > 1)
    doc.font('Helvetica').fontSize(6.5).text(e.comidas.map((t) => ETIQUETA_COMIDA[t]).join(' + '), x + mm(3), y + mm(4), { width: w - mm(6), align: 'right', lineBreak: false });

  // Nombre y color identificador
  let cy = y + mm(11.5);
  let nx = x + mm(3);
  if (c.colorIdentificador) { doc.circle(nx + mm(1.8), cy + mm(1.9), mm(1.8)).fill(c.colorIdentificador); nx += mm(5); }
  doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(11.5).text(c.nombre, nx, cy, { width: x + w - mm(3) - nx - (c.numeroDireccion === 2 ? mm(12) : 0), lineBreak: false, ellipsis: true });
  if (c.numeroDireccion === 2) {
    doc.roundedRect(x + w - mm(14), cy + mm(0.4), mm(11), mm(4), 1).fill(REALCE);
    doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(6).text('DIR. 2', x + w - mm(14), cy + mm(1.4), { width: mm(11), align: 'center', lineBreak: false });
  }
  cy += mm(5.5);
  doc.moveTo(x + mm(3), cy).lineTo(x + w - mm(3), cy).lineWidth(0.3).strokeColor(BORDE).stroke();
  cy += mm(2);

  // Cocina
  doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(6).text('COCINA', x + mm(3), cy, { characterSpacing: 0.5, lineBreak: false });
  cy += mm(3.2);
  const cocina = e.restriccionesCocina[comida] ?? [];
  if (cocina.length) {
    let bx = x + mm(3);
    doc.font('Helvetica-Bold').fontSize(8);
    for (const r of cocina) {
      const t = `SIN ${r.toUpperCase()}`;
      const bw = doc.widthOfString(t) + mm(3);
      if (bx + bw > x + w - mm(3)) { bx = x + mm(3); cy += mm(5); }
      doc.roundedRect(bx, cy, bw, mm(4.4), 1).fill(ROJO);
      doc.fillColor('#ffffff').text(t, bx + mm(1.5), cy + mm(1.1), { lineBreak: false });
      bx += bw + mm(1.5);
    }
    cy += mm(5.5);
  } else {
    doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(7.5).text('Sin restricciones para este menú', x + mm(3), cy, { lineBreak: false });
    cy += mm(4.5);
  }

  // Despacho
  doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(6).text('DESPACHO', x + mm(3), cy, { characterSpacing: 0.5, lineBreak: false });
  cy += mm(3.2);
  if (e.restriccionesDespacho.length) {
    let bx = x + mm(3);
    doc.font('Helvetica-Bold').fontSize(7.5);
    for (const r of e.restriccionesDespacho) {
      const bw = doc.widthOfString(r) + mm(3);
      if (bx + bw > x + w - mm(3)) { bx = x + mm(3); cy += mm(5); }
      doc.roundedRect(bx, cy, bw, mm(4.2), 1).lineWidth(0.5).strokeColor(NARANJA).stroke();
      doc.fillColor(NARANJA).text(r, bx + mm(1.5), cy + mm(1), { lineBreak: false });
      bx += bw + mm(1.5);
    }
  } else {
    doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(7.5).text('Estándar', x + mm(3), cy, { lineBreak: false });
  }

  // Dirección (anclada abajo) y motorizado
  const baseY = y + h - mm(15);
  doc.moveTo(x + mm(3), baseY).lineTo(x + w - mm(3), baseY).lineWidth(0.3).strokeColor(BORDE).stroke();
  const direccion = [c.direccion, c.edificio && `Edif. ${c.edificio}`, c.piso && `Piso ${c.piso}`].filter(Boolean).join(' · ');
  doc.fillColor(TEXTO).font('Helvetica').fontSize(7.5).text(direccion, x + mm(3), baseY + mm(1.5), { width: w - mm(6), height: mm(4), lineBreak: false, ellipsis: true });
  if (c.referencias) doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(6.5).text(`Ref.: ${c.referencias}`, x + mm(3), baseY + mm(5.2), { width: w - mm(6), lineBreak: false, ellipsis: true });
  const mY = y + h - mm(6);
  doc.moveTo(x + mm(3), mY - mm(1.5)).lineTo(x + w - mm(3), mY - mm(1.5)).lineWidth(0.3).strokeColor(BORDE).stroke();
  let mx = x + mm(3);
  if (e.motorizado?.color) { doc.circle(mx + mm(1.5), mY + mm(1.6), mm(1.5)).fill(e.motorizado.color); mx += mm(4.5); }
  doc.fillColor(e.motorizado ? TEXTO : ROJO).font('Helvetica-Bold').fontSize(7.5).text(e.motorizado?.nombre ?? 'Sin motorizado', mx, mY, { lineBreak: false });
  doc.fillColor(GRIS).font('Helvetica').fontSize(6.5).text(`${c.celular}  ·  ${fechaCorta(dia)}`, x + mm(3), mY + mm(0.5), { width: w - mm(6), align: 'right', lineBreak: false });
}

export async function pdfEtiquetas(negocio: Negocio, d: DiaDeDespacho, entregas: Entrega[], comida: TipoComida | null): Promise<Buffer> {
  const doc = crear({ margen: mm(8) });
  const grupos = porMotorizado(entregas);
  const cols = 2, filas = 4;
  const gapX = doc.page.width - doc.page.margins.left * 2 - cols * ANCHO_ETIQUETA;
  const gapY = mm(2);
  let primera = true;

  for (const g of grupos) {
    const etiquetas = g.entregas.flatMap((e) => (comida ? [comida] : e.comidas).map((c) => ({ e, c })));
    let n = 0;
    for (const { e, c } of etiquetas) {
      if (n % (cols * filas) === 0) {
        if (!primera) doc.addPage();
        primera = false;
        // Cabecera del grupo, discreta, arriba: quién reparte estas.
        doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(7).text(`${g.motorizado?.nombre ?? 'Sin motorizado asignado'}  ·  ${fechaLarga(d.dia)}  ·  ${etiquetas.length} etiquetas`, doc.page.margins.left, doc.page.margins.top - mm(4), { lineBreak: false });
      }
      const i = n % (cols * filas);
      const x = doc.page.margins.left + (i % cols) * (ANCHO_ETIQUETA + gapX);
      const y = doc.page.margins.top + Math.floor(i / cols) * (ALTO_ETIQUETA + gapY);
      dibujarEtiqueta(doc, x, y, e, c, d.dia);
      n++;
    }
  }
  if (primera) {
    cabecera(doc, negocio, 'Etiquetas', fechaLarga(d.dia));
    doc.fillColor(GRIS).font('Helvetica').fontSize(10).text('No hay entregas ese día.', doc.page.margins.left, mm(40));
  }
  return terminar(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hojas de ruta: una hoja por motorizado
// ─────────────────────────────────────────────────────────────────────────────

export async function pdfRutas(negocio: Negocio, d: DiaDeDespacho, entregas: Entrega[], comida: TipoComida | null): Promise<Buffer> {
  const doc = crear();
  const grupos = porMotorizado(entregas);
  const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let primera = true;
  for (const g of grupos) {
    if (!primera) doc.addPage();
    primera = false;
    const titulo = g.motorizado?.nombre ?? 'Sin motorizado asignado';
    const sub = `${fechaLarga(d.dia)}${g.motorizado?.celular ? `  ·  ${g.motorizado.celular}` : ''}  ·  ${g.entregas.length} entrega${g.entregas.length === 1 ? '' : 's'}`;
    let y = cabecera(doc, negocio, `Hoja de ruta · ${titulo}`, sub);
    if (g.motorizado?.color) doc.circle(doc.page.margins.left + ancho - mm(3), doc.page.margins.top + mm(6), mm(3)).fill(g.motorizado.color);
    const columnas: Columna[] = [
      { titulo: '#', ancho: mm(8), alinear: 'center' },
      { titulo: 'Cliente', ancho: mm(40) },
      { titulo: 'Dirección', ancho: mm(70) },
      { titulo: 'Comidas', ancho: mm(28) },
      { titulo: 'Despacho', ancho: mm(28) },
      { titulo: 'Entregado', ancho: mm(12), alinear: 'center' },
    ];
    const filas = g.entregas.map((e, i) => {
      const c = e.cliente;
      const direccion = [c.direccion, [c.edificio && `Edif. ${c.edificio}`, c.piso && `Piso ${c.piso}`].filter(Boolean).join(' · '), c.referencias && `Ref.: ${c.referencias}`, c.numeroDireccion === 2 && '(Dirección 2)'].filter(Boolean).join('\n');
      return [String(i + 1), `${c.nombre}\n${c.celular}`, direccion, (comida ? [comida] : e.comidas).map((x) => ETIQUETA_COMIDA[x]).join(', '), e.restriccionesDespacho.join(', ') || '—', ''];
    });
    y = tabla(doc, y, columnas, filas, { negrita: 1, casilla: 5, alFinalDePagina: () => cabecera(doc, negocio, `Hoja de ruta · ${titulo} (cont.)`, sub) });
    if (d.cancelados.length) {
      doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(8).text(`Cancelaron ese día: ${d.cancelados.map((c) => c.nombre).join(', ')}.`, doc.page.margins.left, y + mm(4), { width: ancho });
    }
  }
  if (primera) {
    cabecera(doc, negocio, 'Hojas de ruta', fechaLarga(d.dia));
    doc.fillColor(GRIS).font('Helvetica').fontSize(10).text('No hay entregas ese día.', doc.page.margins.left, mm(40));
  }
  pies(doc, `${negocio.nombre} · Hojas de ruta · ${fechaCorta(d.dia)}`);
  return terminar(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// Restricciones del día: simples, compuestas y todas
// ─────────────────────────────────────────────────────────────────────────────

export async function pdfRestricciones(
  negocio: Negocio,
  d: DiaDeDespacho,
  todas: { alimento: string; categoria: string; clientes: string[] }[],
): Promise<Buffer> {
  const doc = crear();
  const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = cabecera(doc, negocio, 'Restricciones de cocina', `Con el menú del ${fechaLarga(d.dia)}`);

  const choques = d.entregas.flatMap((e) => Object.entries(e.restriccionesCocina).map(([comida, sin]) => ({ cliente: e.cliente.nombre, comida: comida as TipoComida, sin })));
  const simples = choques.filter((c) => c.sin.length === 1);
  const compuestas = choques.filter((c) => c.sin.length > 1);

  const seccion = (titulo: string, pista: string) => {
    if (y > doc.page.height - doc.page.margins.bottom - mm(30)) { doc.addPage(); y = doc.page.margins.top; }
    doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(11).text(titulo, doc.page.margins.left, y, { width: ancho });
    doc.fillColor(GRIS).font('Helvetica').fontSize(8).text(pista, doc.page.margins.left, y + mm(5), { width: ancho });
    y += mm(11);
  };

  if (!d.menus.length) {
    doc.fillColor(NARANJA).font('Helvetica-Oblique').fontSize(9).text('Ese día no tiene menú cargado: no hay choques que calcular.', doc.page.margins.left, y, { width: ancho });
    y += mm(8);
  }

  seccion(`Simples · ${simples.length}`, 'Una sola sustitución en el plato; agrupadas por alimento para cocinar la variante de una vez.');
  const porAlimento = new Map<string, typeof simples>();
  for (const s of simples) porAlimento.set(s.sin[0], [...(porAlimento.get(s.sin[0]) ?? []), s]);
  y = tabla(doc, y, [{ titulo: 'Sin…', ancho: mm(40) }, { titulo: 'Clientes', ancho: mm(120) }, { titulo: 'N', ancho: mm(16), alinear: 'right' }],
    [...porAlimento.entries()].sort((a, b) => b[1].length - a[1].length).map(([al, lista]) => [`Sin ${al.toLowerCase()}`, lista.map((s) => `${s.cliente} (${ETIQUETA_COMIDA[s.comida].toLowerCase()})`).join(', '), String(lista.length)]),
    { negrita: 0 });
  if (!simples.length) { doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(8.5).text('Ninguna.', doc.page.margins.left + mm(2), y + mm(2)); y += mm(8); }
  y += mm(6);

  seccion(`Compuestas · ${compuestas.length}`, 'Dos o más sustituciones: cada plato se arma aparte.');
  y = tabla(doc, y, [{ titulo: 'Cliente', ancho: mm(50) }, { titulo: 'Comida', ancho: mm(30) }, { titulo: 'Sin…', ancho: mm(96) }],
    compuestas.map((c) => [c.cliente, ETIQUETA_COMIDA[c.comida], c.sin.map((s) => s.toLowerCase()).join(', ')]), { negrita: 0 });
  if (!compuestas.length) { doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(8.5).text('Ninguna.', doc.page.margins.left + mm(2), y + mm(2)); y += mm(8); }
  y += mm(6);

  seccion('Todas las restricciones de los clientes activos', 'Por alimento, tenga o no que ver con el menú de hoy. Para planificar la semana.');
  y = tabla(doc, y, [{ titulo: 'Alimento', ancho: mm(40) }, { titulo: 'Categoría', ancho: mm(26) }, { titulo: 'Clientes', ancho: mm(96) }, { titulo: 'N', ancho: mm(14), alinear: 'right' }],
    todas.map((a) => [a.alimento, a.categoria, a.clientes.join(', '), String(a.clientes.length)]), { negrita: 0 });

  pies(doc, `${negocio.nombre} · Restricciones · ${fechaCorta(d.dia)}`);
  return terminar(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ficha del cliente
// ─────────────────────────────────────────────────────────────────────────────

export type ClienteParaFicha = {
  nombre: string; email: string; celular: string; estado: keyof typeof ETIQUETA_ESTADO_CLIENTE;
  edad: number | null; genero: keyof typeof ETIQUETA_GENERO | null; altura: number | null; peso: number | null;
  frecuenciaActividad: keyof typeof ETIQUETA_ACTIVIDAD | null; instagram: string | null; facebook: string | null; tiktok: string | null;
  tiposComida: TipoComida[];
  direccion: string; edificio: string | null; piso: string | null; referencias: string | null; colorIdentificador: string | null;
  direccion2: string | null; edificio2: string | null; piso2: string | null; referencias2: string | null; diasDireccion2: (keyof typeof ETIQUETA_DIA)[];
  motorizado: string | null; motorizado2: string | null;
  sinAgua: boolean; sinFruta: boolean; sinCubiertos: boolean; envasesPropios: boolean;
  restricciones: { alimento: string; tiposComida: TipoComida[] }[];
  servicio: { resumen: ResumenServicio; diasTotales: number; fechaInicio: Dia; tiposComida: TipoComida[]; diasSemana: (keyof typeof ETIQUETA_DIA)[] } | null;
  creado: Date;
};

export async function pdfFichaCliente(negocio: Negocio, c: ClienteParaFicha, hoy: Dia): Promise<Buffer> {
  const doc = crear();
  const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y = cabecera(doc, negocio, c.nombre, `${c.email}  ·  ${c.celular}  ·  ${ETIQUETA_ESTADO_CLIENTE[c.estado]}  ·  registrado el ${fechaCorta(c.creado)}`);
  if (c.colorIdentificador) doc.circle(doc.page.margins.left + ancho - mm(3), doc.page.margins.top + mm(6), mm(3)).fill(c.colorIdentificador);

  const colW = (ancho - mm(6)) / 2;
  const bloque = (titulo: string, filas: [string, string][], x: number, yy: number) => {
    const relleno = mm(3);
    doc.font('Helvetica').fontSize(8.5);
    const alturas = filas.map(([, v]) => Math.max(mm(4.5), doc.heightOfString(v || '—', { width: colW - relleno * 2 - mm(30) })));
    const alto = mm(9) + alturas.reduce((a, b) => a + b + mm(1.5), 0) + relleno;
    doc.roundedRect(x, yy, colW, alto, 2).lineWidth(0.4).strokeColor(BORDE).stroke();
    doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(7).text(titulo.toUpperCase(), x + relleno, yy + relleno, { characterSpacing: 0.5 });
    doc.moveTo(x + relleno, yy + mm(7)).lineTo(x + colW - relleno, yy + mm(7)).lineWidth(0.3).strokeColor(BORDE).stroke();
    let fy = yy + mm(9.5);
    filas.forEach(([e, v], i) => {
      doc.fillColor(GRIS).font('Helvetica').fontSize(8).text(e, x + relleno, fy, { width: mm(30), lineBreak: false });
      doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(8.5).text(v || '—', x + relleno + mm(30), fy, { width: colW - relleno * 2 - mm(30) });
      fy += alturas[i] + mm(1.5);
    });
    return alto;
  };

  const s = c.servicio;
  const izq: [string, [string, string][]][] = [
    ['Datos personales', [
      ['Edad', c.edad ? String(c.edad) : ''],
      ['Género', c.genero ? ETIQUETA_GENERO[c.genero] : ''],
      ['Altura / peso', [c.altura && `${c.altura} m`, c.peso && `${c.peso} kg`].filter(Boolean).join(' · ')],
      ['Actividad', c.frecuenciaActividad ? ETIQUETA_ACTIVIDAD[c.frecuenciaActividad] : ''],
      ['Redes', [c.instagram, c.facebook, c.tiktok].filter(Boolean).join(' · ')],
      ['Comidas', c.tiposComida.map((t) => ETIQUETA_COMIDA[t]).join(', ')],
    ]],
    ['Dirección 1', [
      ['Dirección', c.direccion],
      ['Edificio / piso', [c.edificio, c.piso].filter(Boolean).join(' · ')],
      ['Referencias', c.referencias ?? ''],
      ['Motorizado', c.motorizado ?? ''],
    ]],
    ['Restricciones de despacho', [['Particularidades', RESTRICCIONES_DESPACHO.filter(([k]) => c[k]).map(([, e]) => e).join(', ') || 'Ninguna (estándar)']]],
  ];
  const der: [string, [string, string][]][] = [
    ['Servicio vigente', s ? [
      ['Estado', ETIQUETA_SITUACION[s.resumen.situacion]],
      ['Días', `${s.resumen.diasConsumidos} consumidos de ${s.diasTotales} · ${s.resumen.diasRestantes} restantes`],
      ['Desde / hasta', `${fechaCorta(s.fechaInicio)} - ${fechaCorta(s.resumen.fechaFin)}`],
      ['Comidas', s.tiposComida.map((t) => ETIQUETA_COMIDA[t]).join(', ')],
      ['Días de la semana', s.diasSemana.map((d) => ETIQUETA_DIA[d]).join(', ')],
      ['Cancelaciones', `${s.resumen.cancelacionesUsadas} de ${s.resumen.maxCancelaciones}`],
    ] : [['Servicio', 'Sin servicio vigente']]],
    ['Dirección 2', c.direccion2 ? [
      ['Dirección', c.direccion2],
      ['Edificio / piso', [c.edificio2, c.piso2].filter(Boolean).join(' · ')],
      ['Referencias', c.referencias2 ?? ''],
      ['Días', c.diasDireccion2.map((d) => ETIQUETA_DIA[d]).join(', ')],
      ['Motorizado', c.motorizado2 ?? ''],
    ] : [['Dirección', 'No tiene']]],
    ['Restricciones de cocina', c.restricciones.length
      ? c.restricciones.map((r) => [`Sin ${r.alimento.toLowerCase()}`, r.tiposComida.length ? `solo en ${r.tiposComida.map((t) => ETIQUETA_COMIDA[t].toLowerCase()).join(', ')}` : 'en todas las comidas'] as [string, string])
      : [['Alimentos', 'Ninguna']]],
  ];

  let yi = y, yd = y;
  for (const [t, f] of izq) yi += bloque(t, f, doc.page.margins.left, yi) + mm(4);
  for (const [t, f] of der) yd += bloque(t, f, doc.page.margins.left + colW + mm(6), yd) + mm(4);

  pies(doc, `${negocio.nombre} · Ficha del cliente · ${fechaLarga(hoy)}`);
  return terminar(doc);
}
