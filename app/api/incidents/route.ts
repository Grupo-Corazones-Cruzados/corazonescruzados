import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { Incident } from '@/types/incidents';

const DATA_FILE = path.join(process.cwd(), 'data', 'incidents.json');
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

async function readIncidents(): Promise<Incident[]> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeIncidents(data: Incident[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2) + '\n');
}

export const dynamic = 'force-dynamic';

// GET /api/incidents?projectId=xxx  (optional filter)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  let incidents = await readIncidents();
  if (projectId) {
    incidents = incidents.filter(i => i.projectId === projectId);
  }
  // newest first
  incidents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json(incidents);
}

// POST /api/incidents  — create (multipart: title, description, clientName, projectId, images[])
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const projectId = form.get('projectId') as string;
    const title = form.get('title') as string;
    const description = form.get('description') as string;
    const clientName = form.get('clientName') as string || 'Cliente';

    if (!projectId || !title || !description) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    const imageFiles = form.getAll('images') as File[];
    const savedImages: string[] = [];

    for (const file of imageFiles) {
      if (file.size === 0) continue;
      const ext = file.name.split('.').pop() || 'png';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);
      savedImages.push(filename);
    }

    const now = new Date().toISOString();
    const incident: Incident = {
      id: Math.random().toString(36).slice(2, 10),
      projectId,
      clientName,
      title,
      description,
      images: savedImages,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const incidents = await readIncidents();
    incidents.push(incident);
    await writeIncidents(incidents);

    return NextResponse.json(incident, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/incidents  — update an incident { id, ...fields }
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const incidents = await readIncidents();
    const idx = incidents.findIndex(i => i.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    incidents[idx] = { ...incidents[idx], ...updates, updatedAt: new Date().toISOString() };
    await writeIncidents(incidents);

    return NextResponse.json(incidents[idx]);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
