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

    // Whisper options: force Spanish, low temperature to avoid hallucinations
    const whisperOpts = {
      model: 'whisper-1' as const,
      language: 'es',
      temperature: 0,
      prompt: 'Transcripción de una conversación en español.',
    };

    let fullText = '';

    if (compressedStat.size <= MAX_WHISPER_SIZE) {
      // Single file
      const compressedBuffer = await fs.readFile(compressedPath);
      const fileForApi = await toFile(compressedBuffer, 'audio.mp3');
      const result = await openai.audio.transcriptions.create({ ...whisperOpts, file: fileForApi });
      fullText = typeof result === 'string' ? result : result.text || '';
    } else {
      // Split into segments — need accurate duration
      let durationSec = await getDuration(compressedPath);

      // Fallback: estimate from file size at 48kbps (bytes = bitrate/8 * seconds)
      if (durationSec <= 0) {
        durationSec = Math.ceil(compressedStat.size * 8 / 48000);
      }

      const numSegments = Math.ceil(durationSec / SEGMENT_SEC);
      console.log(`Transcribe: ${(compressedStat.size / 1024 / 1024).toFixed(1)}MB, ~${Math.round(durationSec / 60)}min, ${numSegments} segments`);

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

        // Skip empty segments (silence at end)
        const segStat = await fs.stat(segPath);
        if (segStat.size < 1000) continue; // less than 1KB = empty/silence

        const segBuffer = await fs.readFile(segPath);
        const segFile = await toFile(segBuffer, `segment-${i}.mp3`);
        const result = await openai.audio.transcriptions.create({ ...whisperOpts, file: segFile });
        const segText = typeof result === 'string' ? result : result.text || '';
        if (segText.trim()) texts.push(segText);
      }

      fullText = texts.join('\n\n');
    }

    await cleanup(tempFiles);

    // Filter out Whisper hallucinations
    let cleaned = fullText;

    // 1. Known phrase patterns
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
      cleaned = cleaned.replace(pattern, '');
    }

    // 2. Detect and remove ANY repeated word/phrase pattern (e.g. "Lo. Lo. Lo..." or "¿Me escuchaste? ¿Me escuchaste?")
    // Matches any phrase (1-40 chars) repeated 5+ times consecutively
    cleaned = cleaned.replace(/(.{1,40}?)\s*(\1[\s.?!,]*){4,}/gi, (match, phrase) => {
      return phrase.trim();
    });

    // Remove lines that are just whitespace
    cleaned = cleaned.split('\n').filter(l => l.trim()).join('\n');

    if (!cleaned.trim()) {
      return NextResponse.json({ error: 'No se pudo extraer texto del audio' }, { status: 400 });
    }

    const originalName = file.name.replace(/\.[^.]+$/, '');
    return new NextResponse(cleaned, {
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
