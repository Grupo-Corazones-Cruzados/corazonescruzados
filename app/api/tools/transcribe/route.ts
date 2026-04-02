import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
// @ts-ignore
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const execFileAsync = promisify(execFile);
const FFMPEG = ffmpegInstaller.path as string;

export const maxDuration = 300;

const MAX_WHISPER_SIZE = 24 * 1024 * 1024; // 24MB safe margin
const SEGMENT_SEC = 900; // 15 minutes per segment

async function cleanup(files: string[]) {
  for (const f of files) { try { await fs.unlink(f); } catch {} }
}

async function getDuration(filePath: string): Promise<number> {
  // Use ffmpeg stderr output to get duration (no ffprobe needed)
  try {
    await execFileAsync(FFMPEG, ['-i', filePath, '-f', 'null', '-'], { timeout: 10000 });
  } catch (err: any) {
    // ffmpeg writes info to stderr even on "error" exit
    const output = err.stderr || '';
    const match = output.match(/Duration:\s*(\d+):(\d+):(\d+)/);
    if (match) {
      return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    }
  }
  return 0;
}

export async function POST(req: NextRequest) {
  const tempFiles: string[] = [];
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'Archivo de audio requerido' }, { status: 400 });
    if (!file.name.match(/\.(mp3|m4a|mp4|wav|ogg|webm)$/i)) {
      return NextResponse.json({ error: 'Solo archivos de audio (MP3, M4A, WAV, OGG, WEBM)' }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 });
    }

    const id = randomUUID();
    const ext = file.name.split('.').pop() || 'm4a';
    const inputPath = join(tmpdir(), `tr-${id}.${ext}`);
    const compressedPath = join(tmpdir(), `tr-${id}-c.mp3`);
    tempFiles.push(inputPath, compressedPath);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inputPath, buffer);

    // Compress to mono 16kHz 48kbps mp3
    await execFileAsync(FFMPEG, [
      '-i', inputPath, '-y', '-ac', '1', '-ar', '16000', '-b:a', '48k', '-f', 'mp3', compressedPath,
    ], { timeout: 120000 });

    const compressedStat = await fs.stat(compressedPath);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let fullText = '';

    if (compressedStat.size <= MAX_WHISPER_SIZE) {
      // Single file
      const compressedBuffer = await fs.readFile(compressedPath);
      const fileForApi = await toFile(compressedBuffer, 'audio.mp3');
      const result = await openai.audio.transcriptions.create({ file: fileForApi, model: 'whisper-1' });
      fullText = typeof result === 'string' ? result : result.text || '';
    } else {
      // Split into segments
      const durationSec = await getDuration(compressedPath);
      const numSegments = durationSec > 0 ? Math.ceil(durationSec / SEGMENT_SEC) : Math.ceil(compressedStat.size / MAX_WHISPER_SIZE);

      const texts: string[] = [];
      for (let i = 0; i < numSegments; i++) {
        const segPath = join(tmpdir(), `tr-${id}-s${i}.mp3`);
        tempFiles.push(segPath);

        await execFileAsync(FFMPEG, [
          '-i', compressedPath, '-y',
          '-ss', String(i * SEGMENT_SEC),
          '-t', String(SEGMENT_SEC),
          '-ac', '1', '-ar', '16000', '-b:a', '48k', '-f', 'mp3', segPath,
        ], { timeout: 60000 });

        const segBuffer = await fs.readFile(segPath);
        const segFile = await toFile(segBuffer, `segment-${i}.mp3`);
        const result = await openai.audio.transcriptions.create({ file: segFile, model: 'whisper-1' });
        texts.push(typeof result === 'string' ? result : result.text || '');
      }

      fullText = texts.join('\n\n');
    }

    await cleanup(tempFiles);

    if (!fullText.trim()) {
      return NextResponse.json({ error: 'No se pudo extraer texto del audio' }, { status: 400 });
    }

    const originalName = file.name.replace(/\.[^.]+$/, '');
    return new NextResponse(fullText, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${originalName}.txt"`,
      },
    });
  } catch (err: any) {
    await cleanup(tempFiles);
    console.error('Transcribe error:', err.message);
    return NextResponse.json({ error: err.message || 'Error al transcribir' }, { status: 500 });
  }
}
