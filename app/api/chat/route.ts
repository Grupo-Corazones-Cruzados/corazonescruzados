import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
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

// Store session IDs per agent so conversations have context
const agentSessions = new Map<string, string>();

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

export async function POST(req: Request) {
  try {
    const { agentId, agentName, message, projectPath } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const persona = PERSONAS[agentId] || `You are ${agentName}, a helpful Digimon assistant. Keep responses concise.`;

    await sendHeartbeat(agentId, agentName, 'thinking', 'Reading message...');

    const args = [
      '-p', message,
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

    // Resume previous session for this agent (maintains conversation context)
    const prevSessionId = agentSessions.get(agentId);
    let isResume = false;
    if (prevSessionId) {
      // Verify session file exists before trying to resume
      try {
        const sessDir = path.join(process.env.HOME || '', '.claude', 'projects');
        // Just try to resume - if it fails, we'll catch it below
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

    let sentFirstChunk = false;
    let currentTask = 'Processing...';
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let buffer = '';

        proc.stdout.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

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
                // Save session from init event
                if (event.session_id) agentSessions.set(agentId, event.session_id);
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'init', tools: event.tools })}\n\n`)
                );
              } else if (event.type === 'assistant') {
                const contents = event.message?.content || [];
                for (const block of contents) {
                  if (block.type === 'thinking') {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'thinking', text: block.thinking })}\n\n`)
                    );
                  } else if (block.type === 'text') {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'text', text: block.text })}\n\n`)
                    );
                  } else if (block.type === 'tool_use') {
                    currentTask = `${block.name}: ${JSON.stringify(block.input).slice(0, 60)}`;
                    sendHeartbeat(agentId, agentName, 'working', currentTask);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        type: 'tool_use',
                        tool: block.name,
                        input: block.input,
                        id: block.id,
                      })}\n\n`)
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
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'tool_result',
                    result: resultPreview,
                  })}\n\n`)
                );
              } else if (event.type === 'result') {
                // If resume failed, clear the session so next attempt starts fresh
                if (event.subtype === 'error_during_execution' || event.is_error) {
                  agentSessions.delete(agentId);
                }
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'result',
                    subtype: event.subtype,
                    cost: event.total_cost_usd,
                    duration: event.duration_ms,
                    turns: event.num_turns,
                  })}\n\n`)
                );
              }
            } catch {}
          }
        });

        proc.stderr.on('data', (chunk: Buffer) => {
          const errText = chunk.toString().trim();
          if (errText && (errText.includes('Error') || errText.includes('error'))) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', text: errText })}\n\n`)
            );
          }
        });

        proc.on('close', () => {
          sendHeartbeat(agentId, agentName, 'idle', null as any);
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        });

        proc.on('error', (err) => {
          sendHeartbeat(agentId, agentName, 'error', 'CLI error');
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              text: `Claude CLI error: ${err.message}`,
            })}\n\n`)
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
