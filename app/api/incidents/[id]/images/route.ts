import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { guardarFotosIncidencia } from '@/lib/media/incidencias';
import { quitar } from '@/lib/media';

export const dynamic = 'force-dynamic';

// POST /api/incidents/[id]/images — add images to existing incident (multipart)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const form = await req.formData();
    const imageFiles = form.getAll('images') as File[];

    if (imageFiles.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    // A Drive (2026-10-13), ya no como base64 dentro de la fila.
    const newImages = await guardarFotosIncidencia(imageFiles, incident, incident.images.length);

    const updated = await prisma.incident.update({
      where: { id },
      data: { images: [...incident.images, ...newImages] },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/incidents/[id]/images — remove image by index
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { imageIndex } = await req.json();

    if (typeof imageIndex !== 'number') {
      return NextResponse.json({ error: 'imageIndex required' }, { status: 400 });
    }

    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    if (imageIndex < 0 || imageIndex >= incident.images.length) {
      return NextResponse.json({ error: 'Invalid imageIndex' }, { status: 400 });
    }

    const updatedImages = incident.images.filter((_, i) => i !== imageIndex);

    const updated = await prisma.incident.update({
      where: { id },
      data: { images: updatedImages },
    });
    // Después de quitarla de la fila: si Drive falla, sobra un archivo, no falta una foto.
    await quitar(incident.images[imageIndex]).catch((e) => console.error('[incidencias] papelera de Drive', e?.message));

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
