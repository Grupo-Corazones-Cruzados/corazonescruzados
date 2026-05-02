import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const SESSIONS_PATH = path.join(process.cwd(), 'data', 'agent-sessions.json');

export async function POST(req: NextRequest) {
  const { agentId, sessionKey } = await req.json();
  const key = sessionKey || agentId;
  if (!key) {
    return NextResponse.json({ error: 'sessionKey or agentId required' }, { status: 400 });
  }

  try {
    const raw = await fs.readFile(SESSIONS_PATH, 'utf-8').catch(() => '{}');
    const sessions = JSON.parse(raw);
    delete sessions[key];
    await fs.writeFile(SESSIONS_PATH, JSON.stringify(sessions, null, 2));
  } catch {}

  return NextResponse.json({ ok: true });
}
