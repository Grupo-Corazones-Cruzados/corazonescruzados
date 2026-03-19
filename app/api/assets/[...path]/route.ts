import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getProjectPath } from '@/lib/world';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const projectPublic = path.join(getProjectPath(), 'public');
    const filePath = path.join(projectPublic, ...segments);

    // Security: ensure the resolved path is within the public directory
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(projectPublic))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const buffer = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();

    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
    };

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=5',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
