/**
 * Pasa una nota de voz a texto con Whisper. Una sola definición: la usan el portal de proyectos
 * y el dictado del espacio de trabajo.
 */
const ALUCINACIONES = ['subtítulos', 'suscríbete', 'gracias por ver', 'amara.org', 'like', 'subscribe', 'thanks for watching'];

function extension(mime: string): string {
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('x-m4a')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav') || mime.includes('wave')) return 'wav';
  if (mime.includes('flac')) return 'flac';
  if (mime.includes('aac')) return 'mp4';
  return 'webm';
}

export class ErrorTranscripcion extends Error {}

export async function transcribir(audio: Blob, mime: string, pista = 'código, programación, proyecto, GCC World'): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ErrorTranscripcion('OPENAI_API_KEY not configured');
  const ext = extension(mime);
  const form = new FormData();
  form.append('file', audio, `audio.${ext}`);
  form.append('model', 'whisper-1');
  form.append('language', 'es');
  form.append('temperature', '0.2');
  form.append('response_format', 'verbose_json');
  form.append('prompt', pista);
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new ErrorTranscripcion(`Whisper API error (${res.status}): ${err || 'Unknown error'}. File: ${ext}, size: ${(audio.size / 1024).toFixed(0)}KB`);
  }
  const data = await res.json();
  const bajo = String(data.text || '').toLowerCase();
  if (!String(data.text || '').trim() || ALUCINACIONES.some((a) => bajo.includes(a))) return '';

  // Una proporción de compresión alta o una probabilidad baja delatan texto inventado.
  let limpio = String(data.text);
  if (Array.isArray(data.segments)) {
    const validos = data.segments.filter((seg: { compression_ratio: number; avg_logprob: number; no_speech_prob: number }) =>
      !(seg.compression_ratio > 2.4 || seg.avg_logprob < -1.0 || seg.no_speech_prob > 0.6));
    if (!validos.length) return '';
    limpio = validos.map((seg: { text: string }) => seg.text).join('').trim();
  }
  return deduplicateRepeatedText(limpio).trim();
}

/**
 * Detects and removes repeated phrases/words that Whisper hallucinates.
 * For example: "hola hola hola hola" → "hola"
 * Or: "esto es una prueba esto es una prueba esto es una prueba" → "esto es una prueba"
 */
function deduplicateRepeatedText(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);

  // Try phrase lengths from 1 word up to half the total words
  for (let phraseLen = 1; phraseLen <= Math.floor(words.length / 2); phraseLen++) {
    const phrase = words.slice(0, phraseLen).join(' ');
    const pattern = new RegExp(
      `^(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*){2,}$`,
      'i'
    );
    if (pattern.test(trimmed)) {
      return phrase;
    }
  }

  // Also check for a trailing repeated segment that's identical to the first part
  // e.g. "Quiero hacer algo. Quiero hacer algo." → "Quiero hacer algo."
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length >= 2) {
    const unique = [...new Set(sentences.map(s => s.trim().toLowerCase()))];
    if (unique.length === 1) {
      return sentences[0];
    }
  }

  return trimmed;
}
