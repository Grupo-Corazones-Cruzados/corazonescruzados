import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { contextoApi } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { ETIQUETA_PEDIDO, ETIQUETA_PAGO } from '@/lib/pedidos';

export const dynamic = 'force-dynamic';

/**
 * Exportación del reporte a Excel. Dos hojas: los pedidos y su detalle por plato,
 * que es lo que de verdad sirve para saber qué se vende.
 *
 * ⚠️ Los números van como NÚMEROS, no como texto ya formateado: el formato es-ES
 * («1.234,56») es para la pantalla; dentro de una hoja convertiría cada importe en
 * una cadena con la que no se puede sumar.
 *
 * Y esto no es un adorno: con la retención de un mes, esta hoja es lo ÚNICO que le
 * queda al negocio de lo que pasó antes.
 */
export async function GET(peticion: Request, { params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const ctx = await contextoApi(negocio, 'cobrar');
  if (!ctx) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const url = new URL(peticion.url);
  const desde = url.searchParams.get('desde');
  const hasta = url.searchParams.get('hasta');
  const estado = url.searchParams.get('estado');
  const metodo = url.searchParams.get('metodo');

  const pedidos = await prisma.pedido.findMany({
    where: {
      inquilinoId: ctx.inquilino.id,
      ...(desde ? { dia: { gte: new Date(`${desde}T00:00:00.000Z`) } } : {}),
      ...(hasta ? { dia: { lte: new Date(`${hasta}T00:00:00.000Z`) } } : {}),
      ...(estado ? { estado: estado as never } : {}),
      ...(metodo ? { metodoPago: metodo as never } : {}),
    },
    orderBy: [{ dia: 'asc' }, { numero: 'asc' }],
    include: { mesa: { include: { zona: true } }, mesero: true, items: true },
  });

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Gestión de Pedidos · Grupo Corazones Cruzados';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Pedidos');
  hoja.columns = [
    { header: 'Día', key: 'dia', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Hora', key: 'hora', width: 10, style: { numFmt: 'hh:mm' } },
    { header: 'Nº', key: 'numero', width: 7 },
    { header: 'Zona', key: 'zona', width: 16 },
    { header: 'Mesa', key: 'mesa', width: 12 },
    { header: 'Atendió', key: 'mesero', width: 20 },
    { header: 'Comensales', key: 'comensales', width: 12 },
    { header: 'Platos', key: 'platos', width: 8 },
    { header: 'Base', key: 'base', width: 12, style: { numFmt: '#,##0.00' } },
    { header: 'IVA', key: 'iva', width: 12, style: { numFmt: '#,##0.00' } },
    { header: 'Total', key: 'total', width: 12, style: { numFmt: '#,##0.00' } },
    { header: 'Pago', key: 'pago', width: 14 },
    { header: 'Estado', key: 'estado', width: 16 },
  ];
  hoja.getRow(1).font = { bold: true };

  for (const p of pedidos) {
    hoja.addRow({
      dia: p.dia,
      hora: p.creado,
      numero: p.numero,
      zona: p.mesa.zona.nombre,
      mesa: p.mesa.nombre,
      mesero: p.mesero?.nombre ?? '',
      comensales: p.comensales ?? '',
      platos: p.items.reduce((a, i) => a + i.cantidad, 0),
      base: Number(p.subtotal),
      iva: Number(p.iva),
      total: Number(p.total),
      pago: p.metodoPago ? ETIQUETA_PAGO[p.metodoPago] : '',
      estado: ETIQUETA_PEDIDO[p.estado],
    });
  }

  if (pedidos.length) {
    const n = pedidos.length + 2;
    const fila = hoja.addRow({
      dia: `Total (${pedidos.length})`,
      base: { formula: `SUM(I2:I${n - 1})` },
      iva: { formula: `SUM(J2:J${n - 1})` },
      total: { formula: `SUM(K2:K${n - 1})` },
    });
    fila.font = { bold: true };
    fila.eachCell((c) => (c.border = { top: { style: 'thin' } }));
  }

  // Segunda hoja: qué se vendió, plato a plato. Es la que responde «¿qué sale más?».
  const detalle = libro.addWorksheet('Platos');
  detalle.columns = [
    { header: 'Día', key: 'dia', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Pedido', key: 'numero', width: 8 },
    { header: 'Mesa', key: 'mesa', width: 12 },
    { header: 'Producto', key: 'producto', width: 30 },
    { header: 'Cantidad', key: 'cantidad', width: 10 },
    { header: 'Precio', key: 'precio', width: 12, style: { numFmt: '#,##0.00' } },
    { header: 'Importe', key: 'importe', width: 12, style: { numFmt: '#,##0.00' } },
    { header: 'Nota', key: 'nota', width: 28 },
  ];
  detalle.getRow(1).font = { bold: true };
  for (const p of pedidos)
    for (const i of p.items)
      detalle.addRow({
        dia: p.dia,
        numero: p.numero,
        mesa: p.mesa.nombre,
        producto: i.nombre,
        cantidad: i.cantidad,
        precio: Number(i.precioUnitario),
        importe: Number(i.precioUnitario) * i.cantidad,
        nota: i.notas ?? '',
      });

  const datos = await libro.xlsx.writeBuffer();
  const nombre = `pedidos-${ctx.inquilino.slug}-${desde || 'inicio'}_${hasta || 'hoy'}.xlsx`;

  return new NextResponse(datos as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
}
