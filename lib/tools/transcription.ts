import { pool } from '@/lib/db';
import OpenAI, { toFile } from 'openai';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
// @ts-ignore
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const execFileAsync = promisify(execFile);
const FFMPEG = ffmpegInstaller.path as string;

const SEGMENT_SEC = 600;         // 10 min por segmento
const MIN_SEGMENT_SIZE = 5000;   // <5KB = fin del audio
const CONCURRENCY = 3;           // segmentos transcritos en paralelo
const MAX_SEGMENTS = 20;         // tope de seguridad ≈ 3.3 h
const STALE_MS = 6 * 60 * 1000;  // sin avance en 6 min → trabajo interrumpido

let ensuring: Promise<void> | null = null;
/** Crea la tabla de trabajos de transcripción (troceo + persistencia por segmento). */
export function ensureTranscriptionTable(): Promise<void> {
  if (ensuring) return ensuring;
  const p = pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.transcription_jobs (
      id UUID PRIMARY KEY,
      user_id TEXT,
      filename TEXT,
      status VARCHAR(12) NOT NULL DEFAULT 'processing',  -- processing | done | error
      total_segments INT,
      done_segments INT NOT NULL DEFAULT 0,
      segments JSONB NOT NULL DEFAULT '{}',              -- { "0": "texto", "1": "texto", ... }
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).then(() => undefined).catch((e: any) => { ensuring = null; throw e; });
  ensuring = p;
  return p;
}

async function cleanup(files: string[]) {
  for (const f of files) { try { await fs.unlink(f); } catch {} }
}

/** True si el error de red/OpenAI es transitorio y conviene reintentar. */
export function isTransient(e: any): boolean {
  const msg = String(e?.message || '').toLowerCase();
  const status = e?.status ?? e?.code;
  return msg.includes('aborted') || msg.includes('econnreset') || msg.includes('etimedout')
    || msg.includes('timeout') || msg.includes('fetch failed') || msg.includes('socket')
    || status === 429 || (typeof status === 'number' && status >= 500 && status < 600);
}

/** Transcribe UN segmento con reintentos ante cortes transitorios de red hacia OpenAI. */
async function transcribeSegmentWithRetry(openai: OpenAI, opts: any, segBuffer: Buffer, name: string, attempts = 3): Promise<any> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const segFile = await toFile(segBuffer, name);
      return await openai.audio.transcriptions.create({ ...opts, file: segFile });
    } catch (e: any) {
      lastErr = e;
      if (!isTransient(e) || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

/** Extrae el texto útil de un resultado de Whisper, descartando sub-segmentos claramente malos. */
function extractSegmentText(result: any): string {
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
    return kept.map((s: any) => s.text).join(' ').trim();
  }
  return (result?.text || '').trim();
}

/** Colapsa una palabra/token repetido 3+ veces seguidas (bounded → sin backtracking catastrófico). */
function collapseWordRuns(text: string): string {
  return text.replace(/\b([\p{L}\p{N}'’-]{1,40})(?:\s+\1\b){2,}/giu, '$1');
}
/** Colapsa oraciones idénticas consecutivas con un escaneo lineal (sin regex con backreference). */
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

const HALLUCINATIONS = [
  /thank you for watching[.!]*/gi,
  /please subscribe to my channel[.!]*/gi,
  /go to [\w.]+\.com for all of your .+ needs[.!]*/gi,
  /gracias por ver el video[.!]*/gi,
  /suscr[ií]bete a mi canal[.!]*/gi,
  /no te olvides de suscribirte[.!]*/gi,
  /dale like y suscr[ií]bete[.!]*/gi,
  /hola a todos y bienvenidos a mi canal[.!]*/gi,
];

/** Une los segmentos (en orden) en el texto final del .txt y limpia alucinaciones/bucles. */
export function assembleTranscript(segments: Record<string, string> | null, total: number | null): string {
  const map = segments || {};
  const n = total ?? Object.keys(map).length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (map[String(i)] || '').trim();
    if (t) parts.push(t);
  }
  let full = parts.join('\n\n');
  for (const p of HALLUCINATIONS) full = full.replace(p, '');
  full = full.split('\n\n').map((p) => collapseSentenceRuns(collapseWordRuns(p))).filter((p) => p.trim()).join('\n\n');
  return full.trim();
}

/**
 * Procesa un trabajo de transcripción EN SEGUNDO PLANO: trocea el audio en segmentos de 10 min,
 * los transcribe en paralelo (concurrencia acotada) y **persiste cada segmento en la BD conforme
 * termina**. Así, aunque el contenedor se reinicie o un segmento falle, no se pierde lo ya hecho.
 * Nunca lanza: deja el estado en 'done' o 'error' en la fila del trabajo.
 */
export async function processTranscriptionJob(jobId: string, inputPath: string): Promise<void> {
  const tempFiles: string[] = [inputPath];
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const whisperOpts = { model: 'whisper-1' as const, language: 'es', temperature: 0, response_format: 'verbose_json' as const };
  try {
    // 1) Trocear todo el audio (secuencial y rápido: solo produce .mp3).
    const segPaths: string[] = [];
    for (let i = 0; i < MAX_SEGMENTS; i++) {
      const segPath = join(tmpdir(), `tr-${jobId}-s${i}.mp3`);
      try {
        await execFileAsync(FFMPEG, [
          '-i', inputPath, '-y',
          '-ss', String(i * SEGMENT_SEC), '-t', String(SEGMENT_SEC),
          '-ac', '1', '-ar', '16000', '-b:a', '64k', '-f', 'mp3', segPath,
        ], { timeout: 60000 });
      } catch { break; }
      let size = 0;
      try { size = (await fs.stat(segPath)).size; } catch { break; }
      if (size < MIN_SEGMENT_SIZE) { await fs.unlink(segPath).catch(() => {}); break; }
      segPaths.push(segPath);
      tempFiles.push(segPath);
    }

    await pool.query(`UPDATE gcc_world.transcription_jobs SET total_segments = $2, updated_at = NOW() WHERE id = $1`, [jobId, segPaths.length]);
    if (segPaths.length === 0) {
      await pool.query(`UPDATE gcc_world.transcription_jobs SET status = 'error', error = $2, updated_at = NOW() WHERE id = $1`, [jobId, 'No se pudo extraer audio del archivo']);
      return;
    }

    // 2) Transcribir en paralelo; persistir cada segmento en cuanto termina.
    let nextIdx = 0;
    const worker = async () => {
      while (true) {
        const i = nextIdx++;
        if (i >= segPaths.length) return;
        let text = '';
        try {
          const segBuffer = await fs.readFile(segPaths[i]);
          const result: any = await transcribeSegmentWithRetry(openai, whisperOpts, segBuffer, `segment-${i}.mp3`);
          text = extractSegmentText(result);
        } catch (e: any) {
          // Un segmento que falla no tumba todo el trabajo: se marca y se sigue.
          text = `[Segmento ${i + 1}: no se pudo transcribir]`;
          console.error(`[transcription] segmento ${i} falló:`, e?.message);
        }
        await pool.query(
          `UPDATE gcc_world.transcription_jobs
              SET segments = segments || jsonb_build_object($2::text, $3::text),
                  done_segments = done_segments + 1, updated_at = NOW()
            WHERE id = $1`,
          [jobId, String(i), text],
        );
        await fs.unlink(segPaths[i]).catch(() => {});
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, segPaths.length) }, () => worker()));

    await pool.query(`UPDATE gcc_world.transcription_jobs SET status = 'done', updated_at = NOW() WHERE id = $1`, [jobId]);
  } catch (e: any) {
    console.error('[transcription] job error:', e?.message);
    await pool.query(`UPDATE gcc_world.transcription_jobs SET status = 'error', error = $2, updated_at = NOW() WHERE id = $1`, [jobId, String(e?.message || 'Error')]).catch(() => {});
  } finally {
    await cleanup(tempFiles);
  }
}

/** Lee un trabajo y marca como 'error' los que quedaron colgados (contenedor reiniciado). */
export async function getTranscriptionJob(jobId: string): Promise<any | null> {
  const { rows: [job] } = await pool.query(`SELECT * FROM gcc_world.transcription_jobs WHERE id = $1`, [jobId]);
  if (!job) return null;
  if (job.status === 'processing' && Date.now() - new Date(job.updated_at).getTime() > STALE_MS) {
    job.status = 'error';
    job.error = 'El procesamiento se interrumpió; se conserva lo transcrito hasta ahora.';
    await pool.query(`UPDATE gcc_world.transcription_jobs SET status = 'error', error = $2, updated_at = NOW() WHERE id = $1`, [jobId, job.error]).catch(() => {});
  }
  return job;
}
