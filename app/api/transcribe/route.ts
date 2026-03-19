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
    whisperForm.append('temperature', '0');
    whisperForm.append('prompt', 'Agumon, Gabumon, Gumdramon, Shoutmon, Patamon, Digimon, código, programación, proyecto, GCC WORLD');

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

    return NextResponse.json({ text: data.text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
