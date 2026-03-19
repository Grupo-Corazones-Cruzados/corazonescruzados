import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/incidents?projectId=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  const incidents = await prisma.incident.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(incidents);
}

// POST /api/incidents — create (multipart)
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const projectId = form.get('projectId') as string;
    const title = form.get('title') as string;
    const description = form.get('description') as string;
    const clientName = (form.get('clientName') as string) || 'Cliente';
    const severity = (form.get('severity') as string) || 'medium';

    if (!projectId || !title || !description) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Save images as base64 data URIs in the DB (Railway has ephemeral filesystem)
    const imageFiles = form.getAll('images') as File[];
    const savedImages: string[] = [];

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
      savedImages.push(dataUri);
    }

    const incident = await prisma.incident.create({
      data: {
        projectId,
        clientName,
        title,
        description,
        severity,
        images: savedImages,
        status: 'pending',
      },
    });

    return NextResponse.json(incident, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/incidents — update { id, ...fields }
export async function PUT(req: Request) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const incident = await prisma.incident.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json(incident);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
