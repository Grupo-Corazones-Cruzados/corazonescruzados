import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const LINKS_FILE = path.join(process.cwd(), 'data', 'agent-links.json');
const PORTS_FILE = path.join(process.cwd(), 'data', 'agent-ports.json');
const URLS_FILE = path.join(process.cwd(), 'data', 'agent-urls.json');

async function readJson(file: string): Promise<Record<string, any>> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch {
    return {};
  }
}

async function writeJson(file: string, data: Record<string, any>) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

export const dynamic = 'force-dynamic';

// Get all agent config (links + ports)
export async function GET() {
  const links = await readJson(LINKS_FILE);
  const ports = await readJson(PORTS_FILE);
  const urls = await readJson(URLS_FILE);
  // Merge into single response: { agentId: { projectPath, port, productionUrl } }
  const result: Record<string, { projectPath?: string; port?: number; productionUrl?: string }> = {};
  for (const [id, path] of Object.entries(links)) {
    result[id] = { projectPath: path as string };
  }
  for (const [id, port] of Object.entries(ports)) {
    if (!result[id]) result[id] = {};
    result[id].port = port as number;
  }
  for (const [id, url] of Object.entries(urls)) {
    if (!result[id]) result[id] = {};
    result[id].productionUrl = url as string;
  }
  return NextResponse.json(result);
}

// Set agent config
export async function PUT(req: Request) {
  try {
    const { agentId, projectPath, port, productionUrl } = await req.json();
    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
    }

    // Update project path
    if (projectPath !== undefined) {
      const links = await readJson(LINKS_FILE);
      if (projectPath) {
        links[agentId] = projectPath;
      } else {
        delete links[agentId];
      }
      await writeJson(LINKS_FILE, links);
    }

    // Update port
    if (port !== undefined) {
      const ports = await readJson(PORTS_FILE);
      if (port) {
        ports[agentId] = port;
      } else {
        delete ports[agentId];
      }
      await writeJson(PORTS_FILE, ports);
    }

    // Update production URL
    if (productionUrl !== undefined) {
      const urls = await readJson(URLS_FILE);
      if (productionUrl) {
        urls[agentId] = productionUrl;
      } else {
        delete urls[agentId];
      }
      await writeJson(URLS_FILE, urls);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
