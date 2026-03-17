import { type ChildProcess } from 'child_process';

export interface DevServer {
  proc: ChildProcess;
  port: number | null;
  logs: string[];
  startedAt: number;
  command: string;
  lastPing: number;
}

// Shared singleton map of running dev servers
export const servers = new Map<string, DevServer>();

function killServer(projectPath: string) {
  const server = servers.get(projectPath);
  if (!server) return;
  try { server.proc.kill('SIGTERM'); } catch {}
  try { if (server.proc.pid) process.kill(server.proc.pid, 'SIGTERM'); } catch {}
  servers.delete(projectPath);
}

export function killAllServers() {
  for (const key of [...servers.keys()]) {
    killServer(key);
  }
}

export function pingServer(projectPath: string) {
  const server = servers.get(projectPath);
  if (server) server.lastPing = Date.now();
}

// Auto-cleanup: kill servers that haven't been pinged in 30 seconds
if (typeof process !== 'undefined' && !(globalThis as any).__devServerCleanupRegistered) {
  (globalThis as any).__devServerCleanupRegistered = true;

  setInterval(() => {
    const now = Date.now();
    for (const [key, server] of servers) {
      if (now - server.lastPing > 30000) {
        console.log(`[dev-servers] Auto-killing stale server: ${key}`);
        killServer(key);
      }
    }
  }, 10000);

  const cleanup = () => killAllServers();
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}
