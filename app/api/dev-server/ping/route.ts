import { NextResponse } from 'next/server';
import { servers } from '@/lib/dev-servers';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const paths: string[] = body.paths || [];
    for (const p of paths) {
      const server = servers.get(p);
      if (server) server.lastPing = Date.now();
    }
    return NextResponse.json({ ok: true });
  } catch {
    // Ping all
    for (const server of servers.values()) {
      server.lastPing = Date.now();
    }
    return NextResponse.json({ ok: true });
  }
}
