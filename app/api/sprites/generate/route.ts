import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { buildWalkPrompt, buildActionsPrompt } from '@/lib/sprite-prompts';
import { checkAvailable, generateSpriteSheet } from '@/lib/fal-ai';
import { processWalkSheet, processActionsSheet, buildDoneSheet, saveSprites } from '@/lib/sprite-processor';
import { readWorldConfig, writeWorldConfig } from '@/lib/world';
import type { SpriteJob } from '@/types/sprites';
import type { CitizenDef } from '@/types/world';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

async function updateJob(jobId: string, updates: Partial<SpriteJob>) {
  const jobs = await readJobs();
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx >= 0) {
    jobs[idx] = { ...jobs[idx], ...updates };
    await writeJobs(jobs);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agentId, digimonName, projectPath, persona } = body;

  if (!agentId || !digimonName) {
    return NextResponse.json(
      { error: 'agentId and digimonName are required' },
      { status: 400 }
    );
  }

  const available = await checkAvailable();
  if (!available) {
    return NextResponse.json(
      { error: 'fal.ai API key is not configured. Set FAL_KEY in .env.local' },
      { status: 503 }
    );
  }

  const jobId = `sprite_${agentId}_${Date.now()}`;
  const job: SpriteJob = {
    id: jobId,
    agentId,
    digimonName,
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString(),
  };

  const jobs = await readJobs();
  jobs.push(job);
  await writeJobs(jobs);

  // Run the pipeline in background (non-blocking)
  runPipeline(jobId, agentId, digimonName, projectPath, persona).catch(async (err) => {
    console.error('Sprite pipeline error:', err);
    await updateJob(jobId, {
      status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  });

  return NextResponse.json({ jobId });
}

async function runPipeline(jobId: string, agentId: string, digimonName: string, projectPath?: string, persona?: string) {
  // 1. Build prompts
  await updateJob(jobId, { status: 'generating', progress: 5 });
  const walkPrompt = buildWalkPrompt(digimonName);
  const actionsPrompt = buildActionsPrompt(digimonName);

  // 2. Generate walk sheet with fal.ai
  const walkRaw = await generateSpriteSheet(walkPrompt, async (pct) => {
    // Scale to 5-40% range
    await updateJob(jobId, { progress: 5 + Math.floor(pct * 0.35) });
  });

  // 3. Generate actions sheet with fal.ai
  await updateJob(jobId, { progress: 45 });
  const actionsRaw = await generateSpriteSheet(actionsPrompt, async (pct) => {
    // Scale to 45-75% range
    await updateJob(jobId, { progress: 45 + Math.floor(pct * 0.30) });
  });

  // 4. Process sheets (resize to 256x256)
  await updateJob(jobId, { status: 'processing', progress: 80 });
  const walkSheet = await processWalkSheet(walkRaw);
  const actionsSheet = await processActionsSheet(actionsRaw);
  const doneSheet = await buildDoneSheet(actionsSheet);

  // 5. Save sprite files
  await updateJob(jobId, { status: 'converting', progress: 90 });
  await saveSprites(agentId, { walk: walkSheet, actions: actionsSheet, done: doneSheet });

  // 6. Register citizen in world.json
  await updateJob(jobId, { progress: 95 });
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

  // 7. Register agent-link
  try {
    const linksFile = path.join(process.cwd(), 'data', 'agent-links.json');
    const links = JSON.parse(await fs.readFile(linksFile, 'utf-8').catch(() => '{}'));
    if (!links[agentId]) {
      links[agentId] = projectPath || '';
      await fs.writeFile(linksFile, JSON.stringify(links, null, 2) + '\n');
    }
  } catch {
    console.warn('Could not register agent-link');
  }

  // 8. Save persona if provided
  if (persona) {
    try {
      const personasFile = path.join(process.cwd(), 'data', 'personas.json');
      const personas = JSON.parse(await fs.readFile(personasFile, 'utf-8').catch(() => '{}'));
      personas[agentId] = persona;
      await fs.writeFile(personasFile, JSON.stringify(personas, null, 2) + '\n');
    } catch {
      console.warn('Could not save persona');
    }
  }

  // 9. Done
  await updateJob(jobId, {
    status: 'ready',
    progress: 100,
    completedAt: new Date().toISOString(),
  });
}
