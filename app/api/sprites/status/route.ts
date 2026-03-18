import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { SpriteJob } from '@/types/sprites';

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

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  const agentId = req.nextUrl.searchParams.get('agentId');
  const all = req.nextUrl.searchParams.get('all');

  const jobs = await readJobs();

  if (all === 'true') {
    return NextResponse.json(jobs);
  }

  if (jobId) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    return NextResponse.json(job);
  }

  if (agentId) {
    const agentJobs = jobs.filter((j) => j.agentId === agentId);
    return NextResponse.json(agentJobs);
  }

  return NextResponse.json(jobs);
}
