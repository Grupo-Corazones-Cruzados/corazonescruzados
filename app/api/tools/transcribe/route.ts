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

/** True si el error de red/OpenAI es transitorio y vale la pena reintentar. */
function isTransient(e: any): boolean {
  const msg = String(e?.message || '').toLowerCase();
  const status = e?.status ?? e?.code;
  return msg.includes('aborted') || msg.includes('econnreset') || msg.includes('etimedout')
    || msg.includes('timeout') || msg.includes('fetch failed') || msg.includes('socket')
    || status === 429 || (typeof status === 'number' && status >= 500 && status < 600);
}

/**
 * Transcribe UN segmento con reintentos: un corte transitorio de red hacia OpenAI (p. ej.
 * "aborted"/ECONNRESET) ya no tumba toda la transcripción. Recrea el `File` en cada intento
 * porque el stream se consume al enviarse.
 */
async function transcribeSegmentWithRetry(openai: OpenAI, opts: any, segBuffer: Buffer, name: string, attempts = 3): Promise<any> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const segFile = await toFile(segBuffer, name);
      return await openai.audio.transcriptions.create({ ...opts, file: segFile });
    } catch (e: any) {
      lastErr = e;
      if (!isTransient(e) || i === attempts - 1) throw e;
      console.warn(`Transcribe ${name}: reintento ${i + 1} tras error transitorio (${e?.message})`);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
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
      response_format: 'verbose_json' as const,
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
      const result: any = await transcribeSegmentWithRetry(openai, whisperOpts, segBuffer, `segment-${segIndex}.mp3`);

      // Filter out clearly bad sub-segments using Whisper's per-segment metadata.
      // Only drop on strong signals — low-confidence audio (low avg_logprob) is often
      // legitimate speech with background noise, not hallucination.
      let segText = '';
      if (Array.isArray(result?.segments)) {
        const kept = result.segments.filter((s: any) => {
          const noSpeech = s.no_speech_prob ?? 0;
          const compression = s.compression_ratio ?? 0;
          const logprob = s.avg_logprob ?? 0;
          // Drop only if Whisper itself is almost certain it's silence
          if (noSpeech > 0.9) return false;
          // Drop loop-style hallucinations (very repetitive text compresses heavily)
          if (compression > 2.4) return false;
          // Drop the rare combo of "low confidence" AND "no speech detected" — both wrong together
          if (logprob < -1.0 && noSpeech > 0.6) return false;
          return true;
        });
        segText = kept.map((s: any) => s.text).join(' ').trim();
      } else {
        segText = (result?.text || '').trim();
      }

      if (segText) texts.push(segText);

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
      /hola a todos y bienvenidos a mi canal[.!]*/gi,
    ];
    for (const pattern of hallucinations) {
      fullText = fullText.replace(pattern, '');
    }
    // Remove any phrase (up to 200 chars) repeated 3+ times consecutively
    fullText = fullText.replace(/(.{5,200}?)(?:[\s.?!,]*\1){2,}/gi, (_match, phrase) => phrase.trim());
    // Collapse runs of identical sentences separated by punctuation/whitespace
    fullText = fullText.replace(/([^.!?\n]{10,}[.!?])(\s*\1){1,}/gi, '$1');
    fullText = fullText.split('\n').filter(l => l.trim()).join('\n');

    if (!fullText.trim()) {
      return NextResponse.json({ error: 'No se pudo extraer texto del audio' }, { status: 400 });
    }

    const originalName = file.name.replace(/\.[^.]+$/, '');
    const asciiName = originalName.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '_');
    const encodedName = encodeURIComponent(originalName);
    return new NextResponse(fullText, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${asciiName}.txt"; filename*=UTF-8''${encodedName}.txt`,
      },
    });
  } catch (err: any) {
    await cleanup(tempFiles);
    console.error('Transcribe error:', err.message);
    const friendly = isTransient(err)
      ? 'La transcripción se interrumpió (posible reinicio del servidor o corte de red). Vuelve a intentarlo en un momento.'
      : (err.message || 'Error al transcribir');
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
