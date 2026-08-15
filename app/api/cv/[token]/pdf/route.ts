/**
 * CV público en PDF. Mismo token que la página: revocar el enlace apaga los dos.
 *
 * `Content-Disposition: attachment` con el nombre de la persona — quien lo descarga
 * es un reclutador que va a guardarlo en una carpeta con otros veinte;
 * «documento.pdf» ahí se pierde.
 */
import { NextRequest, NextResponse } from 'next/server';
import { armarCvPublico, miembroDeToken, portadasDePortafolio } from '@/lib/members/cv-share';
import { generarCvPdf } from '@/lib/members/cv-pdf';

export const dynamic = 'force-dynamic';
// PDFKit y sharp son binarios de Node: este endpoint no puede correr en el Edge.
export const runtime = 'nodejs';

/** Nombre de archivo seguro: sin acentos, espacios ni nada que rompa la cabecera. */
function nombreArchivo(nombre: string, talento?: string): string {
  const limpio = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const base = nombre
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'CV';
  // Dos talentos son dos CV distintos: si el archivo se llamara igual, el segundo
  // pisaría al primero en la carpeta de quien los descarga.
  return talento ? `CV-${base}-${limpio(talento)}.pdf` : `CV-${base}.pdf`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    // El PDF sale del talento que se estaba viendo; sin parámetro, el primero.
    const talento = req.nextUrl.searchParams.get('talento') || undefined;
    const memberId = await miembroDeToken(token);
    if (!memberId) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const cv = await armarCvPublico(memberId);
    if (!cv) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const portadas = await portadasDePortafolio(memberId);
    const pdf = await generarCvPdf(cv, portadas, talento);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivo(cv.nombre, talento)}"`,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (err: any) {
    console.error('CV PDF error:', err?.message);
    return NextResponse.json({ error: 'No se pudo generar el PDF' }, { status: 500 });
  }
}
