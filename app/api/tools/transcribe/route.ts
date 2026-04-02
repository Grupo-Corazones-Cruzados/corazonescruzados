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

const SEGMENT_SEC = 600; // 10 minutes per segment
const MIN_SEGMENT_SIZE = 5000; // 5KB — below this means empty/end of audio

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
    tempFiles.push(inputPath);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inputPath, buffer);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const whisperOpts = {
      model: 'whisper-1' as const,
      language: 'es',
      temperature: 0,
      prompt: 'Transcripción de una reunión de trabajo en español.',
    };

    // Split into 10-min segments, compress each individually, keep going until end of audio
    const texts: string[] = [];
    let segIndex = 0;
    let hasMore = true;

    while (hasMore) {
      const segPath = join(tmpdir(), `tr-${id}-s${segIndex}.mp3`);
      tempFiles.push(segPath);

      try {
        await execFileAsync(FFMPEG, [
          '-i', inputPath, '-y',
          '-ss', String(segIndex * SEGMENT_SEC),
          '-t', String(SEGMENT_SEC),
          '-ac', '1', '-ar', '16000', '-b:a', '64k',
          '-f', 'mp3', segPath,
        ], { timeout: 60000 });
      } catch {
        // ffmpeg error usually means we're past the end
        hasMore = false;
        break;
      }

      // Check if segment has actual audio content
      let segSize = 0;
      try {
        const stat = await fs.stat(segPath);
        segSize = stat.size;
      } catch {
        hasMore = false;
        break;
      }

      if (segSize < MIN_SEGMENT_SIZE) {
        // Reached the end of the audio
        hasMore = false;
        break;
      }

      console.log(`Transcribe segment ${segIndex}: ${(segSize / 1024).toFixed(0)}KB`);

      const segBuffer = await fs.readFile(segPath);
      const segFile = await toFile(segBuffer, `segment-${segIndex}.mp3`);
      const result = await openai.audio.transcriptions.create({ ...whisperOpts, file: segFile });
      const segText = typeof result === 'string' ? result : result.text || '';
      if (segText.trim()) texts.push(segText.trim());

      segIndex++;

      // Safety limit: max 20 segments = ~3.3 hours
      if (segIndex >= 20) {
        hasMore = false;
      }
    }

    let fullText = texts.join('\n\n');

    await cleanup(tempFiles);

    // Filter hallucinations
    const hallucinations = [
      /thank you for watching[.!]*/gi,
      /please subscribe to my channel[.!]*/gi,
      /go to [\w.]+\.com for all of your .+ needs[.!]*/gi,
      /gracias por ver el video[.!]*/gi,
      /suscr[ií]bete a mi canal[.!]*/gi,
      /no te olvides de suscribirte[.!]*/gi,
      /dale like y suscr[ií]bete[.!]*/gi,
    ];
    for (const pattern of hallucinations) {
      fullText = fullText.replace(pattern, '');
    }
    // Remove any phrase repeated 5+ times consecutively
    fullText = fullText.replace(/(.{1,40}?)\s*(\1[\s.?!,]*){4,}/gi, (_match, phrase) => phrase.trim());
    fullText = fullText.split('\n').filter(l => l.trim()).join('\n');

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
