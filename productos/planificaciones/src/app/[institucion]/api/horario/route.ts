import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { contextoApi } from '@/lib/inquilino';
import { DIAS, ETIQUETA_DIA, PERIODOS, RECESO, SIN_CLASE, etiquetaPeriodo, horarioDe, materiasDelDocente } from '@/lib/horario';

export const dynamic = 'force-dynamic';

/**
 * El Excel del horario: hoja «Horario» con los once periodos (filas, con la fila
 * del receso en medio) y los cinco días (columnas), cada celda con una lista desplegable de las materias que el
 * docente tiene asignadas (con su grado) y «Sin clase». Sale con lo que ya tenga
 * puesto; se rellena en Excel y se importa desde el perfil.
 */
export async function GET(_p: Request, { params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const ctx = await contextoApi(institucion, 'ver');
  if (!ctx) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 });

  const materias = await materiasDelDocente(ctx.inquilino.id, ctx.sesion.uid, ctx.sesion.rol);
  const actual = await horarioDe(ctx.sesion.uid);
  const opciones = [SIN_CLASE, ...materias.map((m) => m.etiqueta)];

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Planificación de Clases · Grupo Corazones Cruzados';
  // Las opciones en su propia hoja: la lista en línea de Excel tope en 255 caracteres.
  const hojaOpciones = libro.addWorksheet('Opciones');
  opciones.forEach((o, i) => (hojaOpciones.getCell(i + 1, 1).value = o));
  hojaOpciones.getColumn(1).width = 50;

  const hoja = libro.addWorksheet('Horario');
  hoja.getCell(1, 1).value = 'Periodo';
  DIAS.forEach((d, j) => (hoja.getCell(1, j + 2).value = ETIQUETA_DIA[d]));
  hoja.getRow(1).font = { bold: true };
  hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEBFA' } };
  hoja.getColumn(1).width = 20;
  DIAS.forEach((_, j) => (hoja.getColumn(j + 2).width = 42));
  let fila = 2;
  for (const p of PERIODOS) {
    // La primera columna lleva el número y la hora; al importar se lee por ese texto, no por la fila.
    hoja.getCell(fila, 1).value = etiquetaPeriodo(p.numero);
    hoja.getCell(fila, 1).font = { bold: true };
    DIAS.forEach((d, j) => {
      const c = hoja.getCell(fila, j + 2);
      const puesto = actual.find((x) => x.dia === d && x.hora === p.numero);
      if (puesto) c.value = puesto.materiaGradoId === null ? SIN_CLASE : (materias.find((m) => m.id === puesto.materiaGradoId)?.etiqueta ?? null);
      c.dataValidation = { type: 'list', allowBlank: true, formulae: [`Opciones!$A$1:$A$${opciones.length}`], showErrorMessage: true, errorTitle: 'Materia', error: 'Elige una de las materias de la lista o «Sin clase».' };
      c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    fila++;
    if (p.numero === RECESO.trasPeriodo) {
      hoja.getCell(fila, 1).value = `Receso · ${RECESO.desde} – ${RECESO.hasta}`;
      hoja.mergeCells(fila, 2, fila, DIAS.length + 1);
      hoja.getCell(fila, 2).value = 'R E C E S O';
      hoja.getCell(fila, 2).alignment = { horizontal: 'center' };
      hoja.getRow(fila).font = { bold: true };
      hoja.getRow(fila).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5FC1BE' } };
      fila++;
    }
  }
  hoja.getCell(fila + 1, 1).value = 'Elige en cada celda una de tus materias (con su grado) o «Sin clase». Deja vacíos los periodos que no apliquen. Luego importa este archivo desde tu perfil.';
  hoja.getCell(fila + 1, 1).font = { italic: true, color: { argb: 'FF616161' } };

  const buffer = Buffer.from(await libro.xlsx.writeBuffer());
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="horario-${ctx.sesion.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx"`,
    },
  });
}
