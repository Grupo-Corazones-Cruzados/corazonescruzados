import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { apaExtractionSystemPrompt, sanitizeApaExtraction } from '@/lib/centralized/apa';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// POST { text } — interpreta un texto libre y devuelve { ref_tipo, ref_datos } en formato APA.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { text } = await req.json();
    if (!text || !String(text).trim()) return NextResponse.json({ error: 'Falta el texto a interpretar' }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OpenAI no está configurado (OPENAI_API_KEY)' }, { status: 500 });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 700,
        messages: [
          { role: 'system', content: apaExtractionSystemPrompt() },
          { role: 'user', content: `Interpreta esta fuente y devuelve la referencia APA en JSON:\n\n${String(text).slice(0, 6000)}` },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('APA extract OpenAI error:', res.status, err.slice(0, 300));
      return NextResponse.json({ error: 'No se pudo interpretar el texto (error de OpenAI)' }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: 'Respuesta vacía del modelo' }, { status: 502 });

    let parsed: any;
    try { parsed = JSON.parse(content); } catch { return NextResponse.json({ error: 'El modelo no devolvió JSON válido' }, { status: 502 }); }

    const clean = sanitizeApaExtraction(parsed);
    if (!clean) return NextResponse.json({ error: 'No se pudo reconocer un tipo de referencia válido' }, { status: 422 });

    return NextResponse.json({ data: clean });
  } catch (err: any) {
    console.error('APA extract error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
