import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getCitizensDir } from '@/lib/world';
import { processFullSheet, saveSprites } from '@/lib/sprite-processor';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { agentId, imageUrl, yShift } = await req.json();

  if (!agentId) {
    return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
  }

  const citizensDir = getCitizensDir();
  const rawPath = path.join(citizensDir, `${agentId}_raw.png`);

  let rawBuffer: Buffer;

  if (imageUrl) {
    // Download from provided URL and save as raw
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        return NextResponse.json({ error: `Error descargando imagen: ${res.status}` }, { status: 400 });
      }
      rawBuffer = Buffer.from(await res.arrayBuffer());
      // Save as raw for future reprocessing
      await fs.mkdir(citizensDir, { recursive: true });
      await fs.writeFile(rawPath, rawBuffer);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Error descargando imagen' },
        { status: 500 }
      );
    }
  } else {
    // Use existing raw file
    try {
      await fs.access(rawPath);
      rawBuffer = await fs.readFile(rawPath);
    } catch {
      return NextResponse.json(
        { error: 'No se encontro la imagen raw. Usa "Regenerar" primero o proporciona una URL de imagen.' },
        { status: 404 }
      );
    }
  }

  try {
    const sheets = await processFullSheet(rawBuffer, yShift ?? 0);
    await saveSprites(agentId, sheets);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al reprocesar' },
      { status: 500 }
    );
  }
}
