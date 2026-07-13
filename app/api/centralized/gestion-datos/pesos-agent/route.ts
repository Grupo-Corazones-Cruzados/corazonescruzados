import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { runAgentTurn } from '@/lib/centralized/pesos-agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // el turno puede encadenar varias llamadas al CLI

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// POST { premisa_id, session_id?, claude_session_id?, message } — ejecuta un turno del agente de pesos.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { premisa_id, session_id, claude_session_id, message } = await req.json();
    if (!premisa_id) return NextResponse.json({ error: 'Falta premisa_id' }, { status: 400 });
    if (!message?.trim()) return NextResponse.json({ error: 'Falta el mensaje' }, { status: 400 });
    const sessionId = session_id || randomUUID();
    const out = await runAgentTurn({
      premisaId: Number(premisa_id),
      sessionId,
      claudeSessionId: claude_session_id || undefined,
      userMessage: String(message),
    });
    return NextResponse.json({ session_id: sessionId, claude_session_id: out.claudeSessionId, activity: out.activity, sessionWeights: out.sessionWeights });
  } catch (err: any) {
    console.error('pesos-agent error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
