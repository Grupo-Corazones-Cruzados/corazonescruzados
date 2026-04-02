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
// @ts-ignore
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const execFileAsync = promisify(execFile);
const FFMPEG = ffmpegInstaller.path as string;
const FFPROBE = ffprobeInstaller.path as string;
export const maxDuration = 300;

const MAX_WHISPER_SIZE = 24 * 1024 * 1024; // 24MB (safe margin under 25MB limit)
const SEGMENT_MINUTES = 15; // split into 15-min chunks

async function cleanup(files: string[]) {
  for (const f of files) { try { await fs.unlink(f); } catch {} }
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
    const compressedPath = join(tmpdir(), `tr-${id}-compressed.mp3`);
    tempFiles.push(inputPath, compressedPath);

    // Write uploaded file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inputPath, buffer);

    // Compress to mono mp3 at 48kbps (reduces 39MB → ~8-12MB for 1hr audio)
    await execFileAsync(FFMPEG, [
      '-i', inputPath, '-y',
      '-ac', '1',           // mono
      '-ar', '16000',       // 16kHz (Whisper optimal)
      '-b:a', '48k',        // 48kbps
      '-f', 'mp3',
      compressedPath,
    ], { timeout: 120000 });

    const compressedStat = await fs.stat(compressedPath);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let fullText = '';

    if (compressedStat.size <= MAX_WHISPER_SIZE) {
      // Single file — send directly
      const compressedBuffer = await fs.readFile(compressedPath);
      const fileForApi = await toFile(compressedBuffer, 'audio.mp3');
      const result = await openai.audio.transcriptions.create({ file: fileForApi, model: 'whisper-1' });
      fullText = typeof result === 'string' ? result : result.text || '';
    } else {
      // Too large — split into segments
      // Get duration first
      const { stdout } = await execFileAsync(FFPROBE, [
        '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', compressedPath,
      ]);
      const durationSec = parseFloat(stdout.trim()) || 0;
      const segmentSec = SEGMENT_MINUTES * 60;
      const numSegments = Math.ceil(durationSec / segmentSec);

      const segments: string[] = [];
      for (let i = 0; i < numSegments; i++) {
        const segPath = join(tmpdir(), `tr-${id}-seg${i}.mp3`);
        tempFiles.push(segPath);
        segments.push(segPath);

        await execFileAsync(FFMPEG, [
          '-i', compressedPath, '-y',
          '-ss', String(i * segmentSec),
          '-t', String(segmentSec),
          '-ac', '1', '-ar', '16000', '-b:a', '48k',
          '-f', 'mp3', segPath,
        ], { timeout: 60000 });
      }

      // Transcribe each segment sequentially
      const texts: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        const segBuffer = await fs.readFile(segments[i]);
        const segFile = await toFile(segBuffer, `segment-${i}.mp3`);
        const result = await openai.audio.transcriptions.create({ file: segFile, model: 'whisper-1' });
        const text = typeof result === 'string' ? result : result.text || '';
        texts.push(text);
      }

      fullText = texts.join('\n\n');
    }

    // Cleanup
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
