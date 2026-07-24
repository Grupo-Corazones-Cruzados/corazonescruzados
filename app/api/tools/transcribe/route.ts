import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { ensureTranscriptionTable, processTranscriptionJob } from '@/lib/tools/transcription';

export const maxDuration = 300; // solo cubre la SUBIDA del archivo; la transcripción va en 2º plano

/**
 * Inicia una transcripción: sube el audio (streaming a disco, sin cargarlo entero en RAM), crea
 * el trabajo y lanza el procesamiento EN SEGUNDO PLANO (trocea + transcribe + persiste cada trozo).
 * Responde al instante con `{ jobId }`; el cliente consulta el progreso en /status/[jobId].
 */
export async function POST(req: NextRequest) {
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

    await ensureTranscriptionTable();

    const jobId = randomUUID();
    const ext = (file.name.split('.').pop() || 'm4a').toLowerCase();
    const dir = join(tmpdir(), 'transcribe');
    await fs.mkdir(dir, { recursive: true });
    const inputPath = join(dir, `${jobId}.${ext}`);

    // Escribe el audio a disco por streaming (evita el OOM de triplicarlo en memoria).
    await pipeline(Readable.fromWeb(file.stream() as any), createWriteStream(inputPath));

    await pool.query(
      `INSERT INTO gcc_world.transcription_jobs (id, user_id, filename, status) VALUES ($1, $2, $3, 'processing')`,
      [jobId, user.userId, file.name],
    );

    // Fire-and-forget: en un servidor persistente (next start) el proceso sigue tras responder.
    processTranscriptionJob(jobId, inputPath).catch((e) => console.error('[transcribe] job crashed:', e?.message));

    return NextResponse.json({ jobId });
  } catch (err: any) {
    console.error('Transcribe start error:', err.message);
    return NextResponse.json({ error: err.message || 'Error al iniciar la transcripción' }, { status: 500 });
  }
}
