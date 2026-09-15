import { NextResponse } from 'next/server';
import { contextoApi } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { calcularDia } from '@/lib/despacho';
import { esDia, hoyEn } from '@/lib/fechas';
import { ETIQUETA_CATEGORIA } from '@/lib/catalogo';
import { pdfEtiquetas, pdfRutas, pdfRestricciones } from '@/lib/pdf';
import type { TipoComida } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';

/**
 * Los PDF del día: etiquetas, rutas y restricciones. Mismos filtros que la
 * pantalla (día, comida, motorizado) y misma función de cálculo, así que el PDF
 * dice exactamente lo que se ve.
 */
const DOCUMENTOS = {
  etiquetas: { capacidad: 'cocina', nombre: 'Etiquetas' },
  rutas: { capacidad: 'despacho', nombre: 'Rutas' },
  restricciones: { capacidad: 'cocina', nombre: 'Restricciones' },
} as const;

export async function GET(peticion: Request, { params }: { params: Promise<{ negocio: string; documento: string }> }) {
  const { negocio, documento } = await params;
  const def = DOCUMENTOS[documento as keyof typeof DOCUMENTOS];
  if (!def) return NextResponse.json({ error: 'Documento desconocido' }, { status: 404 });
  const ctx = await contextoApi(negocio, def.capacidad);
  if (!ctx) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 });
  const { inquilino } = ctx;

  const q = new URL(peticion.url).searchParams;
  const dia = q.get('dia') && esDia(q.get('dia')!) ? q.get('dia')! : hoyEn(inquilino.zonaHoraria);
  const comida = q.get('comida') && (inquilino.tiposComida as string[]).includes(q.get('comida')!) ? (q.get('comida') as TipoComida) : null;
  const motorizadoId = Number(q.get('motorizado')) || null;

  const d = await calcularDia(inquilino, dia);
  const entregas = d.entregas.filter((e) => (!comida || e.comidas.includes(comida)) && (!motorizadoId || e.motorizado?.id === motorizadoId));

  let pdf: Buffer;
  if (documento === 'etiquetas') pdf = await pdfEtiquetas(inquilino, d, entregas, comida);
  else if (documento === 'rutas') pdf = await pdfRutas(inquilino, d, entregas, comida);
  else {
    const todas = await prisma.clienteRestriccion.findMany({
      where: { cliente: { inquilinoId: inquilino.id, estado: 'ACTIVO' } },
      include: { alimento: { select: { id: true, nombre: true, categoria: true } }, cliente: { select: { nombre: true } } },
    });
    const porAlimento = new Map<number, { alimento: string; categoria: string; clientes: string[] }>();
    for (const r of todas) {
      const x = porAlimento.get(r.alimentoId) ?? { alimento: r.alimento.nombre, categoria: ETIQUETA_CATEGORIA[r.alimento.categoria], clientes: [] };
      x.clientes.push(r.cliente.nombre);
      porAlimento.set(r.alimentoId, x);
    }
    pdf = await pdfRestricciones(inquilino, d, [...porAlimento.values()].sort((a, b) => b.clientes.length - a.clientes.length));
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${documento}-${negocio}-${dia}${comida ? `-${comida.toLowerCase()}` : ''}.pdf"`,
    },
  });
}
