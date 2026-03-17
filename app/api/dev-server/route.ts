import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { servers, type DevServer } from '@/lib/dev-servers';

// Detect dev command and port from package.json
async function detectDevCommand(projectPath: string): Promise<{ command: string; args: string[]; defaultPort: number }> {
  try {
    const pkgPath = path.join(projectPath, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    const scripts = pkg.scripts || {};

    // Check for common dev scripts
    const devScript = scripts.dev || scripts.start || scripts.serve || '';

    // Detect port from script
    let defaultPort = 3000;
    const portMatch = devScript.match(/-p\s+(\d+)|--port\s+(\d+)|PORT=(\d+)/);
    if (portMatch) {
      defaultPort = parseInt(portMatch[1] || portMatch[2] || portMatch[3]);
    }

    // Detect framework
    if (devScript.includes('next')) {
      return { command: 'npm', args: ['run', 'dev'], defaultPort };
    } else if (devScript.includes('vite')) {
      return { command: 'npm', args: ['run', 'dev'], defaultPort: defaultPort || 5173 };
    } else if (devScript.includes('react-scripts')) {
      return { command: 'npm', args: ['start'], defaultPort: defaultPort || 3000 };
    } else if (scripts.dev) {
      return { command: 'npm', args: ['run', 'dev'], defaultPort };
    } else if (scripts.start) {
      return { command: 'npm', args: ['start'], defaultPort };
    }

    return { command: 'npm', args: ['run', 'dev'], defaultPort };
  } catch {
    return { command: 'npm', args: ['run', 'dev'], defaultPort: 3000 };
  }
}

// Strip ANSI escape codes from text
function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\u001b\[\d*[A-Za-z]/g, '');
}

// Extract port from process output
function extractPort(rawText: string): number | null {
  const text = stripAnsi(rawText);
  const patterns = [
    /https?:\/\/localhost:(\d+)/,
    /https?:\/\/127\.0\.0\.1:(\d+)/,
    /https?:\/\/0\.0\.0\.0:(\d+)/,
    /https?:\/\/\[::1?\]:(\d+)/,
    /Local:\s+https?:\/\/[^:]+:(\d+)/,
    /port\s+(\d+)/i,
    /listening\s+(?:on\s+)?(?:port\s+)?:?(\d+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const port = parseInt(m[1]);
      if (port >= 1024 && port <= 65535) return port;
    }
  }
  return null;
}

// GET: List running servers
export async function GET() {
  const list: Record<string, { port: number | null; logs: string[]; startedAt: number; command: string }> = {};
  for (const [projectPath, server] of servers) {
    list[projectPath] = {
      port: server.port,
      logs: server.logs.slice(-20),
      startedAt: server.startedAt,
      command: server.command,
    };
  }
  return NextResponse.json(list);
}

// POST: Start a dev server
export async function POST(req: Request) {
  const { projectPath } = await req.json();
  if (!projectPath) {
    return NextResponse.json({ error: 'Missing projectPath' }, { status: 400 });
  }

  // Check if already tracked by us
  if (servers.has(projectPath)) {
    const server = servers.get(projectPath)!;
    return NextResponse.json({
      status: 'already_running',
      port: server.port,
      logs: server.logs.slice(-20),
    });
  }

  // Verify directory exists
  try {
    await fs.access(projectPath);
  } catch {
    return NextResponse.json({ error: 'Project directory not found' }, { status: 404 });
  }

  // Check if a dev server is ALREADY running externally for this project
  // (e.g. started from a terminal)
  try {
    const { execSync } = require('child_process');
    // Find node processes whose cwd matches the project path
    const ps = execSync(`lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null`, { encoding: 'utf-8' });
    for (const line of ps.split('\n')) {
      const m = line.match(/^node\s+(\d+)\s.*:(\d+)\s+\(LISTEN\)/);
      if (!m) continue;
      const pid = m[1];
      const port = parseInt(m[2]);
      try {
        const cwd = execSync(`lsof -p ${pid} 2>/dev/null | grep cwd | awk '{print $NF}'`, { encoding: 'utf-8' }).trim();
        if (cwd === projectPath || projectPath.startsWith(cwd) || cwd.startsWith(projectPath)) {
          return NextResponse.json({
            status: 'external',
            port,
            logs: [`Dev server already running externally (PID ${pid}) on port ${port}`],
          });
        }
      } catch {}
    }
  } catch {}

  const { command, args, defaultPort } = await detectDevCommand(projectPath);

  // Snapshot ports in use BEFORE starting, so we can exclude them from detection
  const portsBeforeStart = new Set<number>();
  try {
    const { execSync } = require('child_process');
    const lsof = execSync('lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null', { encoding: 'utf-8' });
    for (const m of lsof.matchAll(/:(\d+)\s+\(LISTEN\)/g)) {
      portsBeforeStart.add(parseInt(m[1]));
    }
  } catch {}

  // Pick a free port for the project's backend (PORT env var)
  let freePort = 3010;
  while (portsBeforeStart.has(freePort)) freePort++;

  const proc = spawn(command, args, {
    cwd: projectPath,
    env: { ...process.env, BROWSER: 'none', PORT: String(freePort) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  const server: DevServer = {
    proc,
    port: null,
    logs: [],
    startedAt: Date.now(),
    command: `${command} ${args.join(' ')}`,
    lastPing: Date.now(),
  };

  const addLog = (line: string) => {
    server.logs.push(line);
    if (server.logs.length > 100) server.logs.shift();

    // Try to detect port from output - ONLY new ports (not pre-existing)
    if (!server.port) {
      const port = extractPort(line);
      if (port && !portsBeforeStart.has(port)) server.port = port;
    }
  };

  proc.stdout?.on('data', (chunk: Buffer) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    lines.forEach(addLog);
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    lines.forEach(addLog);
  });

  proc.on('close', (code) => {
    addLog(`[Process exited with code ${code}]`);
    servers.delete(projectPath);
  });

  proc.on('error', (err) => {
    addLog(`[Error: ${err.message}]`);
    servers.delete(projectPath);
  });

  servers.set(projectPath, server);

  // Poll for port detection (up to 15 seconds)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (server.port) break;

    // Also try detecting via lsof every 2 seconds
    if (i > 0 && i % 4 === 0 && proc.pid) {
      try {
        const { execSync } = require('child_process');
        // Find any child processes too (for concurrently, etc)
        const pgrep = execSync(`pgrep -P ${proc.pid} 2>/dev/null || echo ${proc.pid}`, { encoding: 'utf-8' }).trim();
        const pids = pgrep.split('\n').concat([String(proc.pid)]).join('|');
        const lsof = execSync(`lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | grep -E "^\\S+\\s+(${pids})\\s"`, { encoding: 'utf-8' });
        for (const line of lsof.split('\n')) {
          const m = line.match(/:(\d+)\s+\(LISTEN\)/);
          if (m) {
            const p = parseInt(m[1]);
            if (p >= 1024 && !portsBeforeStart.has(p)) { server.port = p; break; }
          }
        }
      } catch {}
    }
  }

  return NextResponse.json({
    status: 'started',
    port: server.port || defaultPort,
    logs: server.logs.slice(-20),
    command: server.command,
  });
}

// DELETE: Stop a dev server
export async function DELETE(req: Request) {
  const { projectPath } = await req.json();
  if (!projectPath) {
    return NextResponse.json({ error: 'Missing projectPath' }, { status: 400 });
  }

  const server = servers.get(projectPath);
  if (!server) {
    return NextResponse.json({ status: 'not_running' });
  }

  try {
    server.proc.kill('SIGTERM');
  } catch {}
  try {
    if (server.proc.pid) process.kill(server.proc.pid, 'SIGTERM');
  } catch {}

  servers.delete(projectPath);
  return NextResponse.json({ status: 'stopped' });
}
