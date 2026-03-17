import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

export const dynamic = 'force-dynamic';

// GET /api/incidents/uploads?file=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file');
  if (!file || file.includes('..') || file.includes('/')) {
    return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
  }

  try {
    const filePath = path.join(UPLOADS_DIR, file);
    const buffer = await fs.readFile(filePath);
    const ext = file.split('.').pop()?.toLowerCase() || 'png';
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    };
    return new Response(buffer, {
      headers: {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
