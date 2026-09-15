import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { contextoApi } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { cargarServicios } from '@/lib/servicios-db';
import { aDia, esDia, hoyEn, mesDe, sumarDias } from '@/lib/fechas';
import { calcularDia } from '@/lib/despacho';
import { ETIQUETA_COMIDA, ETIQUETA_DIA, ETIQUETA_ESTADO_CLIENTE, RESTRICCIONES_DESPACHO } from '@/lib/catalogo';
import { ETIQUETA_SITUACION } from '@/lib/servicios';

export const dynamic = 'force-dynamic';

/**
 * Exportación a Excel: cuatro hojas —servicios, clientes, cancelaciones y
 * entregas por día—. Es la copia que se lleva el negocio antes de la purga de
 * fin de mes. Los números van como números, no como texto ya formateado.
 */
export async function GET(peticion: Request, { params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const ctx = await contextoApi(negocio, 'reportes');
  if (!ctx) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 });
  const { inquilino } = ctx;

  const q = new URL(peticion.url).searchParams;
  const hoy = hoyEn(inquilino.zonaHoraria);
  const mes = mesDe(hoy);
  const desde = q.get('desde') && esDia(q.get('desde')!) ? q.get('desde')! : mes.desde;
  const hasta = q.get('hasta') && esDia(q.get('hasta')!) && q.get('hasta')! >= desde ? q.get('hasta')! : mes.hasta;

  const [servicios, clientes, cancelaciones] = await Promise.all([
    cargarServicios(inquilino),
    prisma.cliente.findMany({ where: { inquilinoId: inquilino.id }, orderBy: { nombre: 'asc' }, include: { motorizado: true, restricciones: { include: { alimento: true } } } }),
    prisma.cancelacion.findMany({ where: { inquilinoId: inquilino.id, fecha: { gte: new Date(`${desde}T00:00:00.000Z`), lte: new Date(`${hasta}T00:00:00.000Z`) } }, include: { cliente: { select: { nombre: true } } }, orderBy: { fecha: 'asc' } }),
  ]);

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Gestión de Catering · Grupo Corazones Cruzados';
  const cabecera = (hoja: ExcelJS.Worksheet) => { hoja.getRow(1).font = { bold: true }; hoja.views = [{ state: 'frozen', ySplit: 1 }]; };

  const hs = libro.addWorksheet('Servicios');
  hs.columns = [
    { header: 'Cliente', key: 'cliente', width: 28 }, { header: 'Estado', key: 'estado', width: 12 }, { header: 'Inicio', key: 'inicio', width: 12 },
    { header: 'Fin estimado', key: 'fin', width: 12 }, { header: 'Días contratados', key: 'total', width: 10 }, { header: 'Consumidos', key: 'consumidos', width: 10 },
    { header: 'Restantes', key: 'restantes', width: 10 }, { header: 'Cancelaciones', key: 'canc', width: 12 }, { header: 'Tope cancel.', key: 'tope', width: 10 },
    { header: 'Comidas', key: 'comidas', width: 24 }, { header: 'Días de la semana', key: 'dias', width: 28 }, { header: 'Renovaciones', key: 'ren', width: 10 }, { header: 'Notas', key: 'notas', width: 30 },
  ];
  for (const s of servicios)
    hs.addRow({ cliente: s.cliente.nombre, estado: ETIQUETA_SITUACION[s.resumen.situacion], inicio: aDia(s.fechaInicio), fin: s.resumen.fechaFin, total: s.diasTotales, consumidos: s.resumen.diasConsumidos, restantes: s.resumen.diasRestantes, canc: s.resumen.cancelacionesUsadas, tope: s.resumen.maxCancelaciones, comidas: s.tiposComida.map((t) => ETIQUETA_COMIDA[t]).join(', '), dias: s.diasSemana.map((d) => ETIQUETA_DIA[d]).join(', '), ren: s.renovaciones, notas: s.notas ?? '' });
  cabecera(hs);

  const hc = libro.addWorksheet('Clientes');
  hc.columns = [
    { header: 'Nombre', key: 'nombre', width: 28 }, { header: 'Correo', key: 'email', width: 28 }, { header: 'Celular', key: 'celular', width: 14 }, { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Dirección', key: 'direccion', width: 36 }, { header: 'Edificio', key: 'edificio', width: 16 }, { header: 'Piso', key: 'piso', width: 10 }, { header: 'Referencias', key: 'ref', width: 30 },
    { header: 'Motorizado', key: 'moto', width: 16 }, { header: 'Dirección 2', key: 'direccion2', width: 36 }, { header: 'Días dir. 2', key: 'dias2', width: 20 },
    { header: 'Despacho', key: 'despacho', width: 28 }, { header: 'Restricciones de cocina', key: 'restr', width: 40 }, { header: 'Registro', key: 'creado', width: 12 },
  ];
  for (const c of clientes)
    hc.addRow({ nombre: c.nombre, email: c.email, celular: c.celular, estado: ETIQUETA_ESTADO_CLIENTE[c.estado], direccion: c.direccion, edificio: c.edificio ?? '', piso: c.piso ?? '', ref: c.referencias ?? '', moto: c.motorizado?.nombre ?? '', direccion2: c.direccion2 ?? '', dias2: c.diasDireccion2.map((d) => ETIQUETA_DIA[d]).join(', '), despacho: RESTRICCIONES_DESPACHO.filter(([k]) => c[k]).map(([, e]) => e).join(', '), restr: c.restricciones.map((r) => r.alimento.nombre).join(', '), creado: c.creado.toISOString().slice(0, 10) });
  cabecera(hc);

  const hx = libro.addWorksheet('Cancelaciones');
  hx.columns = [{ header: 'Día', key: 'dia', width: 12 }, { header: 'Cliente', key: 'cliente', width: 28 }, { header: 'Motivo', key: 'motivo', width: 36 }, { header: 'Quién', key: 'autor', width: 12 }, { header: 'Estado', key: 'estado', width: 12 }];
  for (const c of cancelaciones) hx.addRow({ dia: aDia(c.fecha), cliente: c.cliente.nombre, motivo: c.motivo ?? '', autor: c.autor === 'CLIENTE' ? 'Cliente' : 'Negocio', estado: c.activa ? 'Cancelado' : 'Reactivado' });
  cabecera(hx);

  const he = libro.addWorksheet('Entregas por día');
  he.columns = [{ header: 'Día', key: 'dia', width: 12 }, { header: 'Entregas', key: 'entregas', width: 10 }, { header: 'Comidas', key: 'comidas', width: 10 }, { header: 'Cancelados', key: 'cancelados', width: 10 }, ...inquilino.tiposComida.map((t) => ({ header: ETIQUETA_COMIDA[t], key: t, width: 12 }))];
  let n = 0;
  for (let d = desde; d <= hasta && n < 62; d = sumarDias(d, 1), n++) {
    const x = await calcularDia(inquilino, d);
    const fila: Record<string, unknown> = { dia: d, entregas: x.entregas.length, comidas: x.entregas.reduce((a, e) => a + e.comidas.length, 0), cancelados: x.cancelados.length };
    for (const t of inquilino.tiposComida) fila[t] = x.entregas.filter((e) => e.comidas.includes(t)).length;
    he.addRow(fila);
  }
  cabecera(he);

  const buffer = await libro.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="catering-${negocio}-${desde}-${hasta}.xlsx"`,
    },
  });
}
