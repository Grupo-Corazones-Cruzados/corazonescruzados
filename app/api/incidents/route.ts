import { NextResponse } from 'next/server';
import { prisma, pool } from '@/lib/db';
import { guardarFotosIncidencia } from '@/lib/media/incidencias';

export const dynamic = 'force-dynamic';

// GET /api/incidents?projectId=xxx
// Returns incidents WITHOUT base64 images (lightweight list).
// Uses raw SQL to avoid fetching the heavy images column from the DB.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  const query = `
    SELECT id, "projectId", "clientName", title, description, severity, status,
           "createdAt", "updatedAt",
           COALESCE(array_length(images, 1), 0) AS "imageCount"
    FROM "Incident"
    ${projectId ? 'WHERE "projectId" = $1' : ''}
    ORDER BY "createdAt" DESC
  `;

  const result = projectId
    ? await pool.query(query, [projectId])
    : await pool.query(query);

  return NextResponse.json(result.rows);
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

    // Las fotos van al Drive de la empresa (2026-10-13), no a la fila: hace falta el id de la
    // incidencia para su carpeta, así que primero se crea y luego se le cuelgan.
    const imageFiles = form.getAll('images') as File[];

    const creada = await prisma.incident.create({
      data: { projectId, clientName, title, description, severity, images: [], status: 'pending' },
    });
    let incident = creada;
    if (imageFiles.some((f) => f && f.size > 0)) {
      const urls = await guardarFotosIncidencia(imageFiles, creada);
      incident = await prisma.incident.update({ where: { id: creada.id }, data: { images: urls } });
    }

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

    // Use raw SQL to avoid returning heavy images column
    const incident = await prisma.incident.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        projectId: true,
        clientName: true,
        title: true,
        description: true,
        severity: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(incident);
  } catch (e: any) {
    console.error('PUT /api/incidents error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
