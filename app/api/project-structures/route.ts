import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { ProjectStructure } from '@/types/projects';

const DATA_FILE = path.join(process.cwd(), 'data', 'project-structures.json');

async function readStructures(): Promise<ProjectStructure[]> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeStructures(data: ProjectStructure[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2) + '\n');
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const structures = await readStructures();
  return NextResponse.json(structures);
}

export async function PUT(req: Request) {
  try {
    const structures: ProjectStructure[] = await req.json();
    await writeStructures(structures);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
