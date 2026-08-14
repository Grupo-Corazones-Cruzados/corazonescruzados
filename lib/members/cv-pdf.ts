/**
 * CV en PDF — documento DIBUJADO para papel, no una impresión de la página.
 *
 * ── POR QUÉ PDFKit Y NO UN NAVEGADOR ──────────────────────────────────────────
 * El repo tiene los dos caminos. El de navegador (`lib/cotizaciones/pdf.ts` +
 * puppeteer) construye un HTML y lo fotografía; el de PDFKit dibuja el documento.
 * Se eligió PDFKit por dos motivos, en este orden:
 *   1. **Es el motor probado en producción** — los RIDE de las facturas salen por
 *      aquí a diario. El navegador de puppeteer **no está descargado** en el
 *      entorno, así que esa ruta no está demostrada.
 *   2. **Es literalmente lo que se pidió:** una maqueta pensada para A4 —columna
 *      lateral de color a sangre, retículas propias, saltos de página cuidados—,
 *      que no es la de la pantalla ni podría serlo.
 *
 * ── LA PRIMERA PÁGINA NO SE PARECE A LAS SIGUIENTES, A PROPÓSITO ──────────────
 * La 1 lleva la **columna lateral** con foto, contacto, disponibilidad, salario,
 * skills e idiomas: es la que alguien mira tres segundos antes de decidir si sigue
 * leyendo. De la 2 en adelante el contenido va a **ancho completo**, porque
 * arrastrar la columna vacía por cinco páginas desperdicia un tercio del papel.
 */
import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import sharp from 'sharp';
import {
  DIAS_SEMANA,
  ETIQUETA_ESTADO,
  ETIQUETA_JORNADA,
  ETIQUETA_MODALIDAD,
  textoSalario,
  type CvPublico,
} from '@/lib/members/cv-tipos';

/* ── Paleta (literal, como todo lo que se sirve a terceros) ─────────────────── */
const C = {
  rail: '#181231',
  railSuave: '#2A2150',
  violeta: '#7B5FBF',
  violetaClaro: '#C4B5FD',
  texto: '#1C1B22',
  suave: '#5C5A66',
  tenue: '#8E8C99',
  linea: '#E4E2EA',
  papel: '#FFFFFF',
};

const A4 = { ancho: 595.28, alto: 841.89 };
const RAIL = 196;          // ancho de la columna lateral de la página 1
const MARGEN = 34;         // aire del contenido
const PIE = 46;            // franja inferior reservada

const TIPOS_PORTAFOLIO: Record<string, string> = {
  project: 'Proyecto',
  product: 'Producto',
  automation: 'Automatización',
};

/* ── Imágenes ───────────────────────────────────────────────────────────────── */

/**
 * Deja cualquier imagen en un JPEG que PDFKit sepa incrustar, **como data URL**.
 *
 * PDFKit solo admite JPEG y PNG: una foto en WebP —lo que sirve nuestro propio
 * endpoint de miniaturas— reventaría. Por eso todo pasa por `sharp`.
 *
 * ⚠️ **Y POR QUÉ UNA CADENA Y NO UN `Buffer`, QUE ES LO NATURAL.**
 * `pdfkit.standalone` está pensado para el navegador, así que al empaquetarlo
 * webpack le mete el `Buffer` de la librería `buffer` en lugar del de Node. Su
 * `Buffer.isBuffer(bufferDeNode)` devuelve **false**, PDFImage cree que le han dado
 * una RUTA y termina llamando a `fs.readFileSync`, que en el paquete es un módulo
 * vacío: *«p.readFileSync is not a function»*, un 500 sin más pistas.
 * Con una `data:` URL toma la rama del base64 y funciona. Medido contra el servidor
 * compilado, no deducido: con `Buffer` falla, con data URL sale el PDF.
 *
 * Esto NO le pasaba a los PDF de facturas: son solo texto y nunca incrustan una
 * imagen, así que el fallo no existía hasta este documento.
 *
 * Devuelve `null` ante cualquier problema: **un PDF sin foto es un PDF; un PDF que
 * no se genera no es nada.**
 */
async function aJpeg(raw: string | null | undefined, ancho: number): Promise<string | null> {
  if (!raw) return null;
  try {
    let bruto: Buffer;
    if (raw.startsWith('data:')) {
      bruto = Buffer.from(raw.replace(/^data:[^;]+;base64,/, ''), 'base64');
    } else if (/^https?:\/\//i.test(raw)) {
      // Tope de tiempo: una foto remota que no responde no puede colgar la descarga.
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      try {
        const res = await fetch(raw, { signal: ctrl.signal });
        if (!res.ok) return null;
        bruto = Buffer.from(await res.arrayBuffer());
      } finally {
        clearTimeout(t);
      }
    } else {
      return null;
    }
    const jpeg = await sharp(bruto)
      .resize({ width: ancho, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return null;
  }
}

/* ── Utilidades de texto ────────────────────────────────────────────────────── */

const rango = (a?: string, b?: string) => [a, b].filter(Boolean).join(' – ');

function frasesDisponibilidad(d: CvPublico['disponibilidad']): string[] {
  const cuando =
    d.estado === 'from_date' && d.desde
      ? `Disponible desde el ${new Date(`${d.desde}T12:00:00`).toLocaleDateString('es-EC', {
          day: '2-digit', month: 'long', year: 'numeric',
        })}`
      : ETIQUETA_ESTADO[d.estado];
  return [cuando, ETIQUETA_JORNADA[d.jornada], ETIQUETA_MODALIDAD[d.modalidad]];
}

/* ── El documento ───────────────────────────────────────────────────────────── */

export interface PortadaPortafolio { id: number; fuente: 'propio' | 'proyecto'; imagen: string | null }

/** Clave de la miniatura. ⚠️ Lleva la FUENTE: un proyecto de la app y un ítem
 *  añadido a mano pueden tener el mismo id, y sin ella uno pisaría al otro. */
const claveImagen = (fuente: string, id: number) => `${fuente}-${id}`;

export async function generarCvPdf(cv: CvPublico, portadas: PortadaPortafolio[] = []): Promise<Buffer> {
  // Las imágenes se resuelven ANTES de empezar a dibujar: PDFKit escribe de forma
  // síncrona y no se le puede pedir que espere a una descarga a mitad de una página.
  const foto = await aJpeg(cv.foto, 240);
  const miniaturas = new Map<string, string>();
  for (const p of portadas) {
    const img = await aJpeg(p.imagen, 320);
    if (img) miniaturas.set(claveImagen(p.fuente, p.id), img);
  }

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    const trozos: Buffer[] = [];
    doc.on('data', (c: Buffer) => trozos.push(c));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);

    /* ── Estado de composición ───────────────────────────────────────────────
     * `x` y `ancho` cambian al pasar de la página 1 (con columna lateral) a las
     * siguientes (a ancho completo). Todo lo que dibuja contenido los respeta, así
     * que no hay dos maquetas que mantener: hay una que se ensancha. */
    let x = RAIL + MARGEN;
    let ancho = A4.ancho - RAIL - MARGEN * 2;
    let y = MARGEN + 6;

    const nuevaPagina = () => {
      doc.addPage();
      x = MARGEN + 10;
      ancho = A4.ancho - (MARGEN + 10) * 2;
      // Filete violeta arriba: cose las páginas siguientes con la primera sin
      // repetir la columna entera.
      doc.rect(0, 0, A4.ancho, 5).fill(C.violeta);
      y = MARGEN + 12;
    };

    /** Reserva `alto` puntos; si no caben, salta de página. */
    const sitio = (alto: number) => {
      if (y + alto > A4.alto - PIE) nuevaPagina();
    };

    /** Mide cuánto ocupará un texto sin dibujarlo (para decidir el salto). */
    const alto = (txt: string, tam: number, w: number, interlineado = 1.35) =>
      doc.fontSize(tam).heightOfString(txt, { width: w, lineGap: tam * (interlineado - 1) });

    /* ── PÁGINA 1: columna lateral ──────────────────────────────────────────── */
    doc.rect(0, 0, RAIL, A4.alto).fill(C.rail);

    let ry = 40;
    const rx = 22;
    const rw = RAIL - rx * 2;

    if (foto) {
      // Recuadro de 108×108 con el filo violeta: un círculo exigiría recortar y en
      // PDFKit eso es un `clip`, que arrastra estado y ensucia todo lo que sigue.
      doc.save();
      doc.roundedRect(rx, ry, rw, rw, 10).clip();
      doc.image(foto, rx, ry, { cover: [rw, rw], align: 'center', valign: 'center' });
      doc.restore();
      doc.roundedRect(rx, ry, rw, rw, 10).lineWidth(1).stroke(C.violeta);
      ry += rw + 18;
    } else {
      doc.roundedRect(rx, ry, rw, rw, 10).fill(C.railSuave);
      const iniciales = cv.nombre.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
      doc.fillColor(C.violetaClaro).font('Helvetica-Bold').fontSize(34)
        .text(iniciales, rx, ry + rw / 2 - 20, { width: rw, align: 'center' });
      ry += rw + 18;
    }

    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(15)
      .text(cv.nombre, rx, ry, { width: rw, lineGap: 1 });
    ry = doc.y + 4;

    const subtitulo = cv.titular || cv.cargo;
    if (subtitulo) {
      doc.fillColor(C.violetaClaro).font('Helvetica').fontSize(9)
        .text(subtitulo, rx, ry, { width: rw, lineGap: 1.5 });
      ry = doc.y + 3;
    }
    if (cv.ubicacion) {
      doc.fillColor('#FFFFFF').opacity(0.55).font('Helvetica').fontSize(8)
        .text(cv.ubicacion, rx, ry, { width: rw });
      doc.opacity(1);
      ry = doc.y + 4;
    }

    /** Rótulo de sección dentro de la columna. */
    const rotuloRail = (t: string) => {
      ry += 14;
      doc.fillColor(C.violeta).font('Helvetica-Bold').fontSize(7.5)
        .text(t.toUpperCase(), rx, ry, { width: rw, characterSpacing: 1.1 });
      ry = doc.y + 3;
      doc.moveTo(rx, ry).lineTo(rx + 26, ry).lineWidth(1.2).stroke(C.violeta);
      ry += 8;
    };
    /** Línea de dato de la columna. */
    const lineaRail = (t: string, tam = 8.5, color = '#FFFFFF', opac = 0.82) => {
      doc.fillColor(color).opacity(opac).font('Helvetica').fontSize(tam)
        .text(t, rx, ry, { width: rw, lineGap: 2 });
      doc.opacity(1);
      ry = doc.y + 3;
    };

    // Contacto (solo lo que el miembro encendió)
    if (cv.correo || cv.telefono || cv.linkedin || cv.web) {
      rotuloRail('Contacto');
      if (cv.correo) lineaRail(cv.correo);
      if (cv.telefono) lineaRail(cv.telefono);
      if (cv.linkedin) lineaRail(cv.linkedin.replace(/^https?:\/\//, ''), 7.5);
      if (cv.web) lineaRail(cv.web.replace(/^https?:\/\//, ''), 7.5);
    }

    // Disponibilidad
    rotuloRail('Disponibilidad');
    for (const f of frasesDisponibilidad(cv.disponibilidad)) lineaRail(f);
    if (cv.disponibilidad.nota) lineaRail(cv.disponibilidad.nota, 7.5, '#FFFFFF', 0.6);

    // Aspiración salarial
    if (cv.salario) {
      rotuloRail('Aspiración salarial');
      doc.fillColor(C.violetaClaro).font('Helvetica-Bold').fontSize(13)
        .text(textoSalario(cv.salario), rx, ry, { width: rw });
      ry = doc.y + 1;
      lineaRail('al mes · USD', 7.5, '#FFFFFF', 0.5);
    }

    // Skills e idiomas
    if (cv.skills.length) {
      rotuloRail('Skills');
      lineaRail(cv.skills.join(' · '), 8);
    }
    if (cv.idiomas.length) {
      rotuloRail('Idiomas');
      lineaRail(cv.idiomas.join(' · '), 8);
    }

    // Horario de atención: dato menor, va al final y solo si existe.
    if (cv.disponibilidad.horario.length) {
      rotuloRail('Horario de atención');
      for (const f of cv.disponibilidad.horario) {
        lineaRail(`${DIAS_SEMANA[f.dia - 1] || ''}  ${f.inicio}–${f.fin}`, 7.5, '#FFFFFF', 0.62);
      }
    }

    /* ── Contenido ──────────────────────────────────────────────────────────── */

    /** Rótulo de sección del cuerpo. */
    const seccion = (t: string) => {
      sitio(46);
      y += 6;
      doc.fillColor(C.violeta).font('Helvetica-Bold').fontSize(8)
        .text(t.toUpperCase(), x, y, { width: ancho, characterSpacing: 1.2 });
      y = doc.y + 5;
      doc.moveTo(x, y).lineTo(x + ancho, y).lineWidth(0.8).stroke(C.linea);
      y += 12;
    };

    const parrafo = (t: string, tam = 9.5, color = C.suave) => {
      const h = alto(t, tam, ancho);
      sitio(h + 6);
      doc.fillColor(color).font('Helvetica').fontSize(tam)
        .text(t, x, y, { width: ancho, lineGap: tam * 0.42, align: 'left' });
      y = doc.y + 6;
    };

    // Perfil
    if (cv.bio) {
      seccion('Perfil');
      parrafo(cv.bio, 10, C.texto);
    }

    // Talentos: cada uno con su experiencia, formación y servicios.
    if (cv.talentos.length) {
      seccion('Talentos y trayectoria');
      for (const t of cv.talentos) {
        sitio(40);
        doc.fillColor(C.texto).font('Helvetica-Bold').fontSize(12).text(t.nombre, x, y, { width: ancho });
        y = doc.y + 3;

        if (t.servicios.length) {
          const txt = t.servicios.join(' · ');
          const h = alto(txt, 8.5, ancho);
          sitio(h + 6);
          doc.fillColor(C.violeta).font('Helvetica').fontSize(8.5)
            .text(txt, x, y, { width: ancho, lineGap: 2 });
          y = doc.y + 6;
        }

        const bloque = (
          titulo: string,
          filas: { alto: string; medio: string; bajo: string; fecha: string }[],
        ) => {
          if (!filas.length) return;
          sitio(24);
          doc.fillColor(C.tenue).font('Helvetica-Bold').fontSize(7.5)
            .text(titulo.toUpperCase(), x, y, { width: ancho, characterSpacing: 0.8 });
          y = doc.y + 6;

          for (const f of filas) {
            const hBajo = f.bajo ? alto(f.bajo, 9, ancho - 16) : 0;
            sitio(30 + hBajo);
            // Filete a la izquierda: da ritmo a la lista sin dibujar cajas.
            const yInicio = y;
            doc.fillColor(C.texto).font('Helvetica-Bold').fontSize(10)
              .text(f.alto, x + 16, y, { width: ancho - 16 - 92 });
            const yTrasAlto = doc.y;
            if (f.fecha) {
              doc.fillColor(C.tenue).font('Helvetica').fontSize(8)
                .text(f.fecha, x + ancho - 92, yInicio + 1.5, { width: 92, align: 'right' });
            }
            y = yTrasAlto + 1;
            if (f.medio) {
              doc.fillColor(C.violeta).font('Helvetica').fontSize(8.8)
                .text(f.medio, x + 16, y, { width: ancho - 16 });
              y = doc.y + 1;
            }
            if (f.bajo) {
              doc.fillColor(C.suave).font('Helvetica').fontSize(9)
                .text(f.bajo, x + 16, y, { width: ancho - 16, lineGap: 3 });
              y = doc.y;
            }
            doc.moveTo(x + 4, yInicio + 2).lineTo(x + 4, y).lineWidth(1.5).stroke(C.linea);
            y += 11;
          }
        };

        bloque(
          'Experiencia',
          t.experiencia.map((e) => ({
            alto: e.cargo || e.empresa || 'Experiencia',
            medio: e.cargo ? e.empresa : '',
            bajo: e.descripcion,
            fecha: rango(e.desde, e.hasta),
          })),
        );
        bloque(
          'Formación',
          t.educacion.map((e) => ({
            alto: e.titulo || e.institucion || 'Formación',
            medio: [e.institucion, e.campo].filter(Boolean).join(' · '),
            bajo: '',
            fecha: rango(e.desde, e.hasta),
          })),
        );
        y += 4;
      }
    }

    // Portafolio
    if (cv.portafolio.length) {
      seccion('Portafolio');
      for (const item of cv.portafolio) {
        const mini = miniaturas.get(claveImagen(item.fuente, item.id));
        const anchoTexto = ancho - (mini ? 86 : 0);
        const hDesc = item.descripcion ? alto(item.descripcion, 9, anchoTexto) : 0;
        const altoFila = Math.max(mini ? 58 : 0, 22 + hDesc + (item.etiquetas.length ? 13 : 0));
        sitio(altoFila + 12);

        const yInicio = y;
        if (mini) {
          doc.save();
          doc.roundedRect(x, y, 74, 56, 5).clip();
          doc.image(mini, x, y, { cover: [74, 56], align: 'center', valign: 'center' });
          doc.restore();
          doc.roundedRect(x, y, 74, 56, 5).lineWidth(0.7).stroke(C.linea);
        }
        const tx = x + (mini ? 86 : 0);

        doc.fillColor(C.tenue).font('Helvetica').fontSize(7)
          .text((TIPOS_PORTAFOLIO[item.tipo] || item.tipo).toUpperCase(), tx, y, { width: anchoTexto, characterSpacing: 0.8 });
        y = doc.y + 1;
        doc.fillColor(C.texto).font('Helvetica-Bold').fontSize(10.5)
          .text(item.titulo, tx, y, { width: anchoTexto });
        y = doc.y + 2;
        if (item.descripcion) {
          doc.fillColor(C.suave).font('Helvetica').fontSize(9)
            .text(item.descripcion, tx, y, { width: anchoTexto, lineGap: 2.5 });
          y = doc.y + 2;
        }
        // Un enlace largo (los de vídeo llevan un identificador de 20 cifras) ocupa
        // dos líneas para no decir nada: en papel no se pulsa. Se recorta.
        const enlaceCorto = item.enlace
          ? (() => { const l = item.enlace.replace(/^https?:\/\//, ''); return l.length > 46 ? `${l.slice(0, 45)}…` : l; })()
          : '';
        const pie = [item.etiquetas.join(' · '), enlaceCorto].filter(Boolean).join('   ·   ');
        if (pie) {
          doc.fillColor(C.violeta).font('Helvetica').fontSize(8)
            .text(pie, tx, y, { width: anchoTexto });
          y = doc.y;
        }
        y = Math.max(y, yInicio + (mini ? 56 : 0)) + 14;
      }
    }

    /* ── Pie de todas las páginas ───────────────────────────────────────────── */
    // Se escribe AL FINAL, con `bufferPages`: hasta aquí no se sabía cuántas hay,
    // y «1 de 3» exige conocer el 3.
    const rangoPag = doc.bufferedPageRange();
    const fecha = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' });
    for (let i = 0; i < rangoPag.count; i++) {
      doc.switchToPage(rangoPag.start + i);
      const yPie = A4.alto - 28;
      const xPie = i === 0 ? RAIL + MARGEN : MARGEN + 10;
      const wPie = A4.ancho - xPie - (i === 0 ? MARGEN : MARGEN + 10);
      // ⚠️ EL PIE SE MIDE Y SE RECORTA A MANO.
      // `lineBreak: false` + `ellipsis` **no** impidieron el salto en esta versión de
      // PDFKit: la frase se partía en dos y la segunda línea se metía debajo del
      // «1 / 1». Se vio renderizando el PDF a imagen, no leyendo el código. Medir con
      // `widthOfString` y cortar es determinista y no depende de esas opciones.
      doc.font('Helvetica').fontSize(7);
      const anchoUtil = wPie - 40; // 40 pt reservados al contador
      let pie = `${cv.nombre} · Currículum generado el ${fecha}`;
      while (pie.length > 12 && doc.widthOfString(pie) > anchoUtil) {
        pie = `${pie.slice(0, -2).trimEnd()}…`;
      }
      doc.fillColor(C.tenue).text(pie, xPie, yPie, { width: anchoUtil, lineBreak: false });
      doc.fillColor(C.tenue).font('Helvetica').fontSize(7)
        .text(`${i + 1} / ${rangoPag.count}`, xPie, yPie, { width: wPie, align: 'right', lineBreak: false });
    }

    doc.end();
  });
}
