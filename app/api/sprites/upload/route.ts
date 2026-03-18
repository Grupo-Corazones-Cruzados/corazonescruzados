import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { processWalkSheet, buildDoneSheet, saveSprites, validateDimensions } from '@/lib/sprite-processor';
import { readWorldConfig, writeWorldConfig } from '@/lib/world';
import type { SpriteJob } from '@/types/sprites';
import type { CitizenDef } from '@/types/world';

export const dynamic = 'force-dynamic';

const JOBS_PATH = path.join(process.cwd(), 'data', 'sprite-jobs.json');

async function readJobs(): Promise<SpriteJob[]> {
  try {
    const raw = await fs.readFile(JOBS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeJobs(jobs: SpriteJob[]) {
  await fs.writeFile(JOBS_PATH, JSON.stringify(jobs, null, 2));
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const agentId = formData.get('agentId') as string | null;
  const digimonName = formData.get('digimonName') as string | null;

  if (!file || !agentId || !digimonName) {
    return NextResponse.json(
      { error: 'file, agentId, and digimonName are required' },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate dimensions
  const valid = await validateDimensions(buffer);
  if (!valid) {
    return NextResponse.json(
      { error: 'Image must be 256x256 pixels (4x4 grid of 64x64 frames)' },
      { status: 400 }
    );
  }

  const jobId = `upload_${agentId}_${Date.now()}`;

  try {
    // Process as walk sheet and generate done sheet
    const walkSheet = await processWalkSheet(buffer);
    const doneSheet = await buildDoneSheet(walkSheet);

    // Save files (use walk as both walk and actions for manual uploads)
    await saveSprites(agentId, { walk: walkSheet, actions: walkSheet, done: doneSheet });

    // Register in world.json
    try {
      const config = await readWorldConfig();
      const existingIdx = config.citizens?.findIndex((c: CitizenDef) => c.agentId === agentId);

      if (existingIdx === undefined || existingIdx < 0) {
        const newCitizen: CitizenDef = {
          agentId,
          name: digimonName,
          sprite: agentId,
          position: '',
          type: 'agent',
        };
        if (!config.citizens) config.citizens = [];
        config.citizens.push(newCitizen);
        await writeWorldConfig(config);
      }
    } catch {
      console.warn('Could not register citizen in world.json');
    }

    // Save job record
    const job: SpriteJob = {
      id: jobId,
      agentId,
      digimonName,
      status: 'ready',
      progress: 100,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    const jobs = await readJobs();
    jobs.push(job);
    await writeJobs(jobs);

    return NextResponse.json({ jobId, status: 'ready' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Processing failed' },
      { status: 500 }
    );
  }
}
