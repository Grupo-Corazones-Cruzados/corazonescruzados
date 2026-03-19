import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const SESSIONS_PATH = path.join(process.cwd(), 'data', 'agent-sessions.json');

export async function POST(req: NextRequest) {
  const { agentId } = await req.json();
  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  }

  try {
    const raw = await fs.readFile(SESSIONS_PATH, 'utf-8').catch(() => '{}');
    const sessions = JSON.parse(raw);
    delete sessions[agentId];
    await fs.writeFile(SESSIONS_PATH, JSON.stringify(sessions, null, 2));
  } catch {}

  return NextResponse.json({ ok: true });
}
