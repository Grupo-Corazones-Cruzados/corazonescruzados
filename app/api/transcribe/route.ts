import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const audio = formData.get('audio') as Blob | null;
    const mimeType = formData.get('mimeType') as string || 'audio/webm';

    if (!audio) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Determine correct file extension from mimeType
    // Whisper supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
    let ext = 'webm';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) ext = 'mp3';
    else if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('x-m4a')) ext = 'm4a';
    else if (mimeType.includes('ogg')) ext = 'ogg';
    else if (mimeType.includes('wav') || mimeType.includes('wave')) ext = 'wav';
    else if (mimeType.includes('flac')) ext = 'flac';
    else if (mimeType.includes('aac')) ext = 'mp4';

    // Forward to OpenAI Whisper API
    const whisperForm = new FormData();
    whisperForm.append('file', audio, `audio.${ext}`);
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('language', 'es');
    whisperForm.append('temperature', '0.2');
    whisperForm.append('response_format', 'verbose_json');
    whisperForm.append('prompt', 'Agumon, Gabumon, Piyomon, Shoutmon, Patamon, Digimon, código, programación, proyecto, GCC WORLD');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return NextResponse.json({ error: `Whisper API error (${res.status}): ${err || 'Unknown error'}. File: ${ext}, size: ${(audio.size / 1024).toFixed(0)}KB` }, { status: res.status });
    }

    const data = await res.json();

    // Filter out known Whisper hallucinations
    const hallucinations = [
      'subtítulos', 'suscríbete', 'gracias por ver', 'amara.org',
      'like', 'subscribe', 'thanks for watching',
    ];
    const lower = (data.text || '').toLowerCase();
    const isHallucination = hallucinations.some(h => lower.includes(h));

    if (isHallucination || !data.text?.trim()) {
      return NextResponse.json({ text: '', error: 'No speech detected' });
    }

    // Detect repetitive text (Whisper hallucination pattern)
    // Split into segments and check if the same phrase is repeated
    let cleanText = data.text as string;

    // Check segments for repetition using compression_ratio if available
    if (data.segments && Array.isArray(data.segments)) {
      const validSegments = data.segments.filter((seg: any) => {
        // High compression ratio indicates repetitive/hallucinated text
        if (seg.compression_ratio > 2.4) return false;
        // Very low log probability indicates hallucination
        if (seg.avg_logprob < -1.0) return false;
        // High no_speech_prob means likely no actual speech
        if (seg.no_speech_prob > 0.6) return false;
        return true;
      });
      if (validSegments.length === 0) {
        return NextResponse.json({ text: '', error: 'No speech detected' });
      }
      cleanText = validSegments.map((seg: any) => seg.text).join('').trim();
    }

    // Detect repeated phrases in the final text
    // e.g. "hola hola hola hola" or "esto es una prueba esto es una prueba"
    const deduped = deduplicateRepeatedText(cleanText);

    if (!deduped.trim()) {
      return NextResponse.json({ text: '', error: 'No speech detected' });
    }

    return NextResponse.json({ text: deduped });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
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
