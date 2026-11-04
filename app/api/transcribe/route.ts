import { NextRequest, NextResponse } from 'next/server';
import { transcribir, ErrorTranscripcion } from '@/lib/ia/transcribir';

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }
  try {
    const formData = await req.formData();
    const audio = formData.get('audio') as Blob | null;
    const mimeType = formData.get('mimeType') as string || 'audio/webm';
    if (!audio) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }
    const text = await transcribir(audio, mimeType);
    return text ? NextResponse.json({ text }) : NextResponse.json({ text: '', error: 'No speech detected' });
  } catch (e) {
    return NextResponse.json({ error: e instanceof ErrorTranscripcion || e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
