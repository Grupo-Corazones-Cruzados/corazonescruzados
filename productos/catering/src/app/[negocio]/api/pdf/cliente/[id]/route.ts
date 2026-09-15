import { NextResponse } from 'next/server';
import { contextoApi } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { cargarServicios } from '@/lib/servicios-db';
import { aDia, hoyEn } from '@/lib/fechas';
import { pdfFichaCliente } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

/** La ficha del cliente en PDF, para descargar o mandar. */
export async function GET(_: Request, { params }: { params: Promise<{ negocio: string; id: string }> }) {
  const { negocio, id } = await params;
  const ctx = await contextoApi(negocio, 'clientes');
  if (!ctx) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 });
  const { inquilino } = ctx;

  const c = await prisma.cliente.findFirst({
    where: { id: Number(id), inquilinoId: inquilino.id },
    include: { motorizado: true, motorizado2: true, restricciones: { include: { alimento: true } } },
  });
  if (!c) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  const servicios = await cargarServicios(inquilino, { clienteId: c.id });
  const vigente = servicios.find((s) => s.estado !== 'VENCIDO');

  const pdf = await pdfFichaCliente(inquilino, {
    ...c,
    motorizado: c.motorizado?.nombre ?? null,
    motorizado2: c.motorizado2?.nombre ?? null,
    restricciones: c.restricciones.map((r) => ({ alimento: r.alimento.nombre, tiposComida: r.tiposComida })),
    servicio: vigente ? { resumen: vigente.resumen, diasTotales: vigente.diasTotales, fechaInicio: aDia(vigente.fechaInicio), tiposComida: vigente.tiposComida, diasSemana: vigente.diasSemana } : null,
  }, hoyEn(inquilino.zonaHoraria));

  const nombreArchivo = c.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="ficha-${nombreArchivo}.pdf"` },
  });
}
