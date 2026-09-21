import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { contextoApi } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { nochesEn } from '@/lib/reservas';
import { esDia, inicioDelDiaEn, finDelDiaEn, relojDeParedUtc } from '@/lib/fechas';

export const dynamic = 'force-dynamic';

/**
 * Exportación del reporte a Excel.
 *
 * ⚠️ Los números van como NÚMEROS, no como texto ya formateado: el formato es-ES
 * («1.234,56») es para la pantalla; dentro de una hoja de cálculo convertiría cada
 * importe en una cadena con la que no se puede sumar. El formato se declara en la
 * columna y lo aplica Excel según la configuración de quien la abra.
 */
export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ hotel: string }> },
) {
  const { hotel } = await params;
  const ctx = await contextoApi(hotel);
  if (!ctx) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const url = new URL(peticion.url);
  const desde = url.searchParams.get('desde');
  const hasta = url.searchParams.get('hasta');
  const suite = url.searchParams.get('suite');
  const estado = url.searchParams.get('estado');

  // Los límites son días del HOTEL, no del servidor (UTC).
  const zona = ctx.inquilino.zonaHoraria;
  const reservas = await prisma.reserva.findMany({
    where: {
      inquilinoId: ctx.inquilino.id,
      ...(esDia(hasta) ? { entrada: { lte: finDelDiaEn(hasta, zona) } } : {}),
      ...(esDia(desde) ? { salida: { gte: inicioDelDiaEn(desde, zona) } } : {}),
      ...(suite ? { suiteId: Number(suite) } : {}),
      ...(estado ? { estado: estado as never } : { estado: { not: 'ELIMINADA' as never } }),
    },
    orderBy: { entrada: 'desc' },
    include: { suite: { include: { ubicacion: true } } },
  });

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Gestión de Reservas · Grupo Corazones Cruzados';
  libro.created = new Date();
  const hoja = libro.addWorksheet('Reservas');

  hoja.columns = [
    { header: 'Huésped', key: 'huesped', width: 28 },
    { header: 'Teléfono', key: 'telefono', width: 14 },
    { header: 'Ubicación', key: 'ubicacion', width: 20 },
    { header: 'Suite', key: 'suite', width: 18 },
    { header: 'Entrada', key: 'entrada', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'Salida', key: 'salida', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'Noches', key: 'noches', width: 9 },
    { header: 'Total', key: 'total', width: 12, style: { numFmt: '#,##0.00' } },
    { header: 'Abono', key: 'abono', width: 12, style: { numFmt: '#,##0.00' } },
    { header: 'Saldo', key: 'saldo', width: 12, style: { numFmt: '#,##0.00' } },
    { header: 'Pago', key: 'pago', width: 12 },
    { header: 'Estado', key: 'estado', width: 14 },
  ];

  const cabecera = hoja.getRow(1);
  cabecera.font = { bold: true };
  cabecera.alignment = { vertical: 'middle' };

  const ETIQUETA: Record<string, string> = {
    OCUPADA: 'Ocupada',
    POR_SALIR: 'Por salir',
    FINALIZADA: 'Finalizada',
    ELIMINADA: 'Eliminada',
  };

  for (const r of reservas) {
    const total = Number(r.precioTotal);
    const abono = Number(r.anticipo);
    hoja.addRow({
      huesped: r.clienteNombre,
      telefono: r.telefono ?? '',
      ubicacion: r.suite.ubicacion.nombre,
      suite: r.suite.nombre,
      // ExcelJS convierte un Date a fecha de hoja con sus piezas UTC: se le da
      // uno cuyas piezas UTC son el reloj del hotel, y la celda dice la hora real.
      entrada: relojDeParedUtc(r.entrada, zona),
      salida: relojDeParedUtc(r.salida, zona),
      noches: nochesEn(r.entrada, r.salida, zona),
      total,
      abono,
      saldo: total - abono,
      pago: r.estadoPago === 'PAGADO' ? 'Pagado' : 'Pendiente',
      estado: ETIQUETA[r.estado] ?? r.estado,
    });
  }

  // Fila de totales, en negrita y separada por un borde superior.
  if (reservas.length) {
    const n = reservas.length + 2;
    const fila = hoja.addRow({
      huesped: `Total (${reservas.length})`,
      total: { formula: `SUM(H2:H${n - 1})` },
      abono: { formula: `SUM(I2:I${n - 1})` },
      saldo: { formula: `SUM(J2:J${n - 1})` },
    });
    fila.font = { bold: true };
    fila.eachCell((c) => (c.border = { top: { style: 'thin' } }));
  }

  const datos = await libro.xlsx.writeBuffer();
  const nombre = `reservas-${ctx.inquilino.slug}-${desde || 'inicio'}_${hasta || 'hoy'}.xlsx`;

  return new NextResponse(datos as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
}
