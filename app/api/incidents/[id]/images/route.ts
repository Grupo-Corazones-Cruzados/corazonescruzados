import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

    const newImages: string[] = [];
    for (const file of imageFiles) {
      if (file.size === 0) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', webp: 'image/webp',
      };
      const mime = mimeMap[ext] || 'image/png';
      const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
      newImages.push(dataUri);
    }

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

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
