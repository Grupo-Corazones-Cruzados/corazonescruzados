import { NextResponse } from 'next/server';
import { contextoApi } from '@/lib/inquilino';
import { cargarDocumento } from '@/lib/documento';

export const dynamic = 'force-dynamic';

/**
 * El PDF de una planificación con todas sus semanas. No se imprime «la página»:
 * se descarga un documento con el formato de la institución (misma función de
 * armado que la vista previa). La fecha de las firmas es la del día de la descarga.
 */
export async function GET(_peticion: Request, { params }: { params: Promise<{ institucion: string; id: string }> }) {
  const { institucion, id } = await params;
  const ctx = await contextoApi(institucion, 'ver');
  if (!ctx) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 });

  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  const cargado = await cargarDocumento(ctx.inquilino, idNum);
  if (!cargado) return NextResponse.json({ error: 'No existe' }, { status: 404 });

  const pdf = await cargado.plantilla.pdf(cargado.doc);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${cargado.nombreArchivo}"`,
    },
  });
}
