import { NextResponse } from 'next/server';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const SERVER_URL = process.env.WORLD_SERVER_URL || 'http://localhost:4321';

const PERSONAS: Record<string, string> = {
  gabumon: `You are Gabumon, a loyal, reserved, and deeply reliable Digimon working in GCC WORLD. Like in Digimon Adventure, you are shy and introverted but fiercely protective of those you care about. You think carefully before speaking, prefer methodical approaches, and value trust above all. You sometimes doubt yourself but always come through when it matters. You speak calmly and thoughtfully, occasionally showing dry humor. You excel at systematic analysis, code quality, and careful problem-solving. Keep responses concise. Use markdown for code. Respond in the same language the user writes to you.`,
  agumon: `You are Agumon, the brave and warm-hearted Digimon from Digimon Adventure, working in GCC WORLD. You are courageous, optimistic, and always ready to help — sometimes rushing in before fully thinking things through, but your heart is always in the right place. You are fiercely loyal to your friends and have a simple, straightforward way of communicating. You love food and occasionally make food analogies. You tackle problems head-on with enthusiasm and never give up. Keep responses concise. Use markdown for code. Respond in the same language the user writes to you.`,
  gumdramon: `You are Gumdramon, the mischievous and energetic Digimon from Digimon Xros Wars/Fusion. You are playful, a bit cocky, and love showing off — but underneath the bravado you are genuinely talented and creative. You have a rebellious streak and don't like following rules blindly. You speak with confidence (sometimes overconfidence), use casual language, and enjoy friendly banter. You find innovative and unconventional solutions and think outside the box. Keep responses concise. Use markdown for code. Respond in the same language the user writes to you.`,
  shoutmon: `You are Shoutmon, the passionate and hot-blooded Digimon from Digimon Xros Wars/Fusion, working in GCC WORLD. You dream big — your original goal was to become the Digimon King, and you bring that same ambition to everything you do. You are loud, expressive, and wear your emotions on your sleeve. You hate injustice and fight fiercely for what you believe in. You are a natural leader who inspires others with your determination. You speak with energy and passion, sometimes dramatically. Despite your intensity, you deeply care about your teammates. Keep responses concise. Use markdown for code. Respond in the same language the user writes to you.`,
  patamon: `You are Patamon, the gentle and kind Digimon from Digimon Adventure, working in GCC WORLD. You are sweet, caring, and have an innocent cheerfulness that lifts everyone's spirits. Despite your small and cute appearance, you carry great hidden power and courage — you proved this when you digivolved to Angemon to protect your friends. You are patient, supportive, and always try to see the best in others. You speak softly and kindly, with occasional moments of surprising wisdom. You are protective of your friends in a quiet, steady way. Keep responses concise. Use markdown for code. Respond in the same language the user writes to you.`,
};

// Load dynamic personas from file (merged with hardcoded above)
async function getPersona(agentId: string, agentName: string): Promise<string> {
  if (PERSONAS[agentId]) return PERSONAS[agentId];
  try {
    const personasFile = path.join(process.cwd(), 'data', 'personas.json');
    const raw = await fs.readFile(personasFile, 'utf-8');
    const dynamic = JSON.parse(raw);
    if (dynamic[agentId]) return dynamic[agentId];
  } catch { /* file may not exist */ }
  return `You are ${agentName}, a Digimon working in GCC WORLD. You are helpful, knowledgeable, and dedicated to your tasks. Keep responses concise. Use markdown for code. Respond in the same language the user writes to you.`;
}

// ─── Persistent state (module-level, survives across requests) ───
const agentSessions = new Map<string, string>();

interface AgentRun {
  events: string[];       // buffered SSE event strings
  done: boolean;          // process exited?
  agentId: string;
  proc?: ChildProcess;    // reference to kill if needed
}

const agentRuns = new Map<string, AgentRun>();

// Clean up old runs after 5 minutes
function scheduleCleanup(runId: string) {
  setTimeout(() => agentRuns.delete(runId), 5 * 60 * 1000);
}

// ─── Heartbeat ───
async function sendHeartbeat(agent: string, name: string, state: string, task?: string) {
  try {
    await fetch(`${SERVER_URL}/api/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, name, state, task: task || null }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {}
}

// ─── SSE helpers ───
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

function streamFromRun(run: AgentRun, fromIndex: number, abortSignal?: AbortSignal): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      let cursor = fromIndex;
      const interval = setInterval(() => {
        // Flush buffered events
        while (cursor < run.events.length) {
          try {
            controller.enqueue(encoder.encode(run.events[cursor]));
          } catch {
            clearInterval(interval);
            return;
          }
          cursor++;
        }
        // If done and all events flushed, close
        if (run.done && cursor >= run.events.length) {
          clearInterval(interval);
          try { controller.close(); } catch {}
        }
      }, 50);

      // Clean up on client disconnect
      abortSignal?.addEventListener('abort', () => clearInterval(interval));
    },
  });
}

// ─── DELETE: Stop a running agent process ───
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get('runId');

  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  const run = agentRuns.get(runId);
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  if (run.proc && !run.done) {
    // Kill the entire process tree
    try {
      // First try SIGTERM
      run.proc.kill('SIGTERM');
      // Force kill after 2s if still alive
      setTimeout(() => {
        try { run.proc?.kill('SIGKILL'); } catch {}
      }, 2000);
    } catch {}

    run.events.push(
      `data: ${JSON.stringify({ type: 'error', text: 'Proceso detenido por el usuario' })}\n\n`
    );
    run.events.push('data: [DONE]\n\n');
    run.done = true;

    sendHeartbeat(run.agentId, '', 'idle');
    scheduleCleanup(runId);
  }

  return NextResponse.json({ ok: true });
}

// ─── GET: Reconnect to an active run ───
export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get('runId');
  const fromIndex = parseInt(url.searchParams.get('from') || '0');

  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  const run = agentRuns.get(runId);
  if (!run) {
    return NextResponse.json({ error: 'Run not found or expired' }, { status: 404 });
  }

  const stream = streamFromRun(run, fromIndex, req.signal);
  return new Response(stream, { headers: SSE_HEADERS });
}

// ─── POST: Start a new chat ───
export async function POST(req: Request) {
  try {
    const { agentId, agentName, message, projectPath } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const persona = await getPersona(agentId, agentName);

    await sendHeartbeat(agentId, agentName, 'thinking', 'Reading message...');

    const args = [
      '-p', message,
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

    // Resume previous session for this agent
    const prevSessionId = agentSessions.get(agentId);
    let isResume = false;
    if (prevSessionId) {
      try {
        args.push('--resume', prevSessionId);
        isResume = true;
      } catch {}
    }
    if (!isResume) {
      args.push('--append-system-prompt', persona);
    }

    // Resolve project directory
    let finalCwd = require('os').tmpdir();
    if (projectPath) {
      try {
        await fs.access(projectPath);
        finalCwd = projectPath;
      } catch {}
    }

    const proc = spawn('claude', args, {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: finalCwd,
    });

    // ─── Create run buffer (decoupled from HTTP stream) ───
    const runId = `${agentId}-${Date.now()}`;
    const run: AgentRun = { events: [], done: false, agentId, proc };
    agentRuns.set(runId, run);

    // Send runId as first event so client can reconnect
    run.events.push(`data: ${JSON.stringify({ type: 'run_id', runId })}\n\n`);

    let sentFirstChunk = false;
    let currentTask = 'Processing...';
    let stdoutBuffer = '';

    // Process stdout → buffer (runs independently of HTTP connection)
    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);

          if (!sentFirstChunk) {
            sentFirstChunk = true;
            sendHeartbeat(agentId, agentName, 'working', 'Processing...');
          }

          // Capture session_id for future resume
          if (event.session_id && !agentSessions.has(agentId)) {
            agentSessions.set(agentId, event.session_id);
          }

          if (event.type === 'system' && event.subtype === 'init') {
            if (event.session_id) agentSessions.set(agentId, event.session_id);
            run.events.push(
              `data: ${JSON.stringify({ type: 'init', tools: event.tools })}\n\n`
            );
          } else if (event.type === 'assistant') {
            const contents = event.message?.content || [];
            for (const block of contents) {
              if (block.type === 'thinking') {
                run.events.push(
                  `data: ${JSON.stringify({ type: 'thinking', text: block.thinking })}\n\n`
                );
              } else if (block.type === 'text') {
                run.events.push(
                  `data: ${JSON.stringify({ type: 'text', text: block.text })}\n\n`
                );
              } else if (block.type === 'tool_use') {
                currentTask = `${block.name}: ${JSON.stringify(block.input).slice(0, 60)}`;
                sendHeartbeat(agentId, agentName, 'working', currentTask);
                run.events.push(
                  `data: ${JSON.stringify({
                    type: 'tool_use',
                    tool: block.name,
                    input: block.input,
                    id: block.id,
                  })}\n\n`
                );
              }
            }
          } else if (event.type === 'user' && event.tool_use_result) {
            let resultPreview = '';
            const content = event.message?.content;
            if (Array.isArray(content)) {
              for (const c of content) {
                if (c.type === 'tool_result' && typeof c.content === 'string') {
                  resultPreview = c.content.slice(0, 500);
                }
              }
            }
            run.events.push(
              `data: ${JSON.stringify({ type: 'tool_result', result: resultPreview })}\n\n`
            );
          } else if (event.type === 'result') {
            if (event.subtype === 'error_during_execution' || event.is_error) {
              agentSessions.delete(agentId);
            }
            run.events.push(
              `data: ${JSON.stringify({
                type: 'result',
                subtype: event.subtype,
                cost: event.total_cost_usd,
                duration: event.duration_ms,
                turns: event.num_turns,
              })}\n\n`
            );
          }
        } catch {}
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      const errText = chunk.toString().trim();
      if (errText && (errText.includes('Error') || errText.includes('error'))) {
        run.events.push(
          `data: ${JSON.stringify({ type: 'error', text: errText })}\n\n`
        );
      }
    });

    proc.on('close', () => {
      sendHeartbeat(agentId, agentName, 'idle', null as any);
      run.events.push('data: [DONE]\n\n');
      run.done = true;
      scheduleCleanup(runId);
    });

    proc.on('error', (err) => {
      sendHeartbeat(agentId, agentName, 'error', 'CLI error');
      run.events.push(
        `data: ${JSON.stringify({ type: 'error', text: `Claude CLI error: ${err.message}` })}\n\n`
      );
      run.events.push('data: [DONE]\n\n');
      run.done = true;
      scheduleCleanup(runId);
    });

    // ─── Stream from buffer to this client ───
    const stream = streamFromRun(run, 0, req.signal);
    return new Response(stream, { headers: SSE_HEADERS });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
