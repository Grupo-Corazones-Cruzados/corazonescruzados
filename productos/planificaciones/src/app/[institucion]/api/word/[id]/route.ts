import { NextResponse } from 'next/server';
import { contextoApi } from '@/lib/inquilino';
import { cargarDocumento } from '@/lib/documento';

export const dynamic = 'force-dynamic';

/** El PUD en Word (.docx): mismo modelo y mismos datos que el PDF y la vista previa. */
export async function GET(_peticion: Request, { params }: { params: Promise<{ institucion: string; id: string }> }) {
  const { institucion, id } = await params;
  const ctx = await contextoApi(institucion, 'ver');
  if (!ctx) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 });

  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  const cargado = await cargarDocumento(ctx.inquilino, idNum);
  if (!cargado) return NextResponse.json({ error: 'No existe' }, { status: 404 });

  const docx = await cargado.plantilla.word(cargado.doc);
  return new NextResponse(new Uint8Array(docx), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${cargado.nombreArchivo}.docx"`,
    },
  });
}
