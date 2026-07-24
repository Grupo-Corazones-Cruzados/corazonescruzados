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

export const maxDuration = 600;

const SEGMENT_SEC = 600; // 10 minutes per segment
const MIN_SEGMENT_SIZE = 5000; // 5KB — below this means empty/end of audio

async function cleanup(files: string[]) {
  for (const f of files) { try { await fs.unlink(f); } catch {} }
}

/** Colapsa una palabra/token repetido 3+ veces seguidas (bounded → sin backtracking catastrófico). */
function collapseWordRuns(text: string): string {
  return text.replace(/\b([\p{L}\p{N}'’-]{1,40})(?:\s+\1\b){2,}/giu, '$1');
}
/** Colapsa oraciones idénticas consecutivas con un escaneo LINEAL (sin regex con backreference). */
function collapseSentenceRuns(text: string): string {
  const parts = text.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let prevNorm = '';
  for (const raw of parts) {
    const s = raw.trim();
    if (!s) continue;
    const norm = s.toLowerCase();
    if (norm === prevNorm) continue;
    prevNorm = norm;
    out.push(s);
  }
  return out.join(' ');
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

    // 1) Trocear el audio en segmentos de 10 min (secuencial y rápido). Límite: 20 seg ≈ 3.3 h.
    const segPaths: string[] = [];
    for (let segIndex = 0; segIndex < 20; segIndex++) {
      const segPath = join(tmpdir(), `tr-${id}-s${segIndex}.mp3`);
      try {
        await execFileAsync(FFMPEG, [
          // -ss ANTES de -i = input seeking (busca directo, sin decodificar desde el inicio):
          // clave para que el troceo de audios largos sea rápido.
          '-ss', String(segIndex * SEGMENT_SEC),
          '-i', inputPath, '-y',
          '-t', String(SEGMENT_SEC),
          '-ac', '1', '-ar', '16000', '-b:a', '64k',
          '-f', 'mp3', segPath,
        ], { timeout: 60000 });
      } catch {
        break; // ffmpeg error = ya pasamos del final del audio
      }
      let segSize = 0;
      try { segSize = (await fs.stat(segPath)).size; } catch { break; }
      if (segSize < MIN_SEGMENT_SIZE) { await fs.unlink(segPath).catch(() => {}); break; } // fin del audio
      console.log(`Transcribe segment ${segIndex}: ${(segSize / 1024).toFixed(0)}KB`);
      segPaths.push(segPath);
      tempFiles.push(segPath);
    }

    // 2) Transcribir los segmentos EN PARALELO (3 a la vez) para que un audio largo termine
    //    holgadamente dentro del límite de tiempo (antes, uno por uno, se pasaba de 5 min).
    const segTexts: string[] = new Array(segPaths.length).fill('');
    let nextIdx = 0;
    const worker = async () => {
      while (true) {
        const i = nextIdx++;
        if (i >= segPaths.length) return;
        const segBuffer = await fs.readFile(segPaths[i]);
        const segFile = await toFile(segBuffer, `segment-${i}.mp3`);
        const result: any = await openai.audio.transcriptions.create({ ...whisperOpts, file: segFile });

        // Filter out clearly bad sub-segments using Whisper's per-segment metadata.
        // Only drop on strong signals — low-confidence audio (low avg_logprob) is often
        // legitimate speech with background noise, not hallucination.
        if (Array.isArray(result?.segments)) {
          const kept = result.segments.filter((s: any) => {
            const noSpeech = s.no_speech_prob ?? 0;
            const compression = s.compression_ratio ?? 0;
            const logprob = s.avg_logprob ?? 0;
            if (noSpeech > 0.9) return false;
            if (compression > 2.4) return false;
            if (logprob < -1.0 && noSpeech > 0.6) return false;
            return true;
          });
          segTexts[i] = kept.map((s: any) => s.text).join(' ').trim();
        } else {
          segTexts[i] = (result?.text || '').trim();
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, segPaths.length) }, () => worker()));

    let fullText = segTexts.filter((t) => t.trim()).join('\n\n');

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
    // Colapsa los bucles de Whisper (palabras/oraciones repetidas) con algoritmos LINEALES/ACOTADOS
    // por párrafo, evitando el catastrophic backtracking que podía colgar la CPU en textos largos.
    fullText = fullText
      .split('\n\n')
      .map((p) => collapseSentenceRuns(collapseWordRuns(p)))
      .filter((p) => p.trim())
      .join('\n\n');

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
    return NextResponse.json({ error: err.message || 'Error al transcribir' }, { status: 500 });
  }
}
