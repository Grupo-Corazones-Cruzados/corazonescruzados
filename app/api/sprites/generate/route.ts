import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { buildFullSheetPrompt } from '@/lib/sprite-prompts';
import { checkAvailable, generateSpriteSheet } from '@/lib/fal-ai';
import { processFullSheet, saveSprites } from '@/lib/sprite-processor';
import { readWorldConfig, writeWorldConfig } from '@/lib/world';
import { generateDigimonProfile } from '@/lib/openai';
import { getDigimonEntry, setDigimonEntry, generateFoodSchedule } from '@/lib/digimon-data';
import type { SpriteJob } from '@/types/sprites';
import type { CitizenDef } from '@/types/world';
import type { DigimonData } from '@/types/digimon';

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
  // 1. Generate OpenAI profile FIRST (personalized action descriptions + phrases)
  await updateJob(jobId, { status: 'generating', progress: 5 });
  let profileData: Awaited<ReturnType<typeof generateDigimonProfile>> | null = null;
  try {
    profileData = await generateDigimonProfile(digimonName);
  } catch (err) {
    console.warn('OpenAI profile generation failed, using defaults:', err);
  }

  // 2. Build prompt with personalized actions from OpenAI
  await updateJob(jobId, { progress: 15 });
  const fullPrompt = buildFullSheetPrompt(digimonName, profileData?.actionDescriptions, profileData?.visualDescription);

  // 3. Generate full sprite sheet with fal.ai (single call!)
  const fullSheetRaw = await generateSpriteSheet(fullPrompt, async (pct) => {
    await updateJob(jobId, { progress: 15 + Math.floor(pct * 0.55) });
  });

  // 4. Save raw sheet for future reprocessing
  await updateJob(jobId, { status: 'processing', progress: 72 });
  const citizensDir = (await import('@/lib/world')).getCitizensDir();
  await fs.mkdir(citizensDir, { recursive: true });
  await fs.writeFile(path.join(citizensDir, `${agentId}_raw.png`), fullSheetRaw);

  // 5. Process unified sheet → extract walk, actions, done, eating
  await updateJob(jobId, { progress: 75 });
  const sheets = await processFullSheet(fullSheetRaw);

  // 6. Save sprite files
  await updateJob(jobId, { status: 'converting', progress: 85 });
  await saveSprites(agentId, sheets);

  // 7. Save digimon data (affinity, food schedule, phrases, action descriptions)
  try {
    const existing = await getDigimonEntry(agentId);
    const entry: DigimonData = {
      agentId,
      digimonName,
      affinity: existing?.affinity ?? 0,
      foodSchedule: existing?.foodSchedule ?? { meals: generateFoodSchedule() },
      lastFedDates: existing?.lastFedDates ?? [],
      visualDescription: profileData?.visualDescription ?? existing?.visualDescription ?? '',
      phrases: profileData?.phrases ?? existing?.phrases ?? { tier1: [], tier2: [], tier3: [], tier4: [], tier5: [], tier6: [] },
      actionDescriptions: profileData?.actionDescriptions ?? existing?.actionDescriptions,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    await setDigimonEntry(agentId, entry);
  } catch (err) {
    console.warn('Could not save digimon data:', err);
  }

  // 8. Register citizen in world.json
  await updateJob(jobId, { progress: 93 });
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

  // 9. Register agent-link
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

  // 10. Save persona if provided
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

  // 11. Done
  await updateJob(jobId, {
    status: 'ready',
    progress: 100,
    completedAt: new Date().toISOString(),
  });
}
