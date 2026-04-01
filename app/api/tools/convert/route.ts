import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, readFile } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

const SUPPORTED_CONVERSIONS: Record<string, string[]> = {
  'm4a': ['mp3'],
  'mp4': ['mp3'],
  'wav': ['mp3'],
  'ogg': ['mp3'],
  'webm': ['mp3'],
  'mp3': ['wav', 'ogg'],
};

export async function POST(req: NextRequest) {
  const tempFiles: string[] = [];
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const fromFormat = formData.get('from') as string;
    const toFormat = formData.get('to') as string;

    if (!file || !fromFormat || !toFormat) {
      return NextResponse.json({ error: 'Archivo, formato origen y destino requeridos' }, { status: 400 });
    }

    if (!SUPPORTED_CONVERSIONS[fromFormat]?.includes(toFormat)) {
      return NextResponse.json({ error: `Conversion ${fromFormat} → ${toFormat} no soportada` }, { status: 400 });
    }

    const id = randomUUID();
    const inputPath = join(tmpdir(), `convert-${id}.${fromFormat}`);
    const outputPath = join(tmpdir(), `convert-${id}.${toFormat}`);
    tempFiles.push(inputPath, outputPath);

    // Write input file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);

    // Convert with ffmpeg
    await execFileAsync('ffmpeg', ['-i', inputPath, '-y', '-q:a', '2', outputPath], { timeout: 120000 });

    // Read output
    const outputBuffer = await readFile(outputPath);

    // Cleanup temp files
    for (const f of tempFiles) { try { await unlink(f); } catch {} }

    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
    };

    const originalName = file.name.replace(/\.[^.]+$/, '');
    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': mimeTypes[toFormat] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${originalName}.${toFormat}"`,
      },
    });
  } catch (err: any) {
    // Cleanup on error
    for (const f of tempFiles) { try { await unlink(f); } catch {} }
    console.error('Convert error:', err.message);
    return NextResponse.json({ error: err.message || 'Error al convertir' }, { status: 500 });
  }
}
