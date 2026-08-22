import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { apaExtractionSystemPrompt, sanitizeApaExtraction } from '@/lib/centralized/apa';
import { chatJSON, iaConfigurada } from '@/lib/ia/openai';

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

    if (!iaConfigurada()) return NextResponse.json({ error: 'La IA no está configurada (OPENAI_API_KEY)' }, { status: 500 });

    let parsed: any;
    try {
      // Extracción mecánica: no hace falta que el modelo se lo piense mucho.
      parsed = await chatJSON({
        system: apaExtractionSystemPrompt(),
        user: `Interpreta esta fuente y devuelve la referencia APA en JSON:\n\n${String(text).slice(0, 6000)}`,
        maxTokens: 3000,
        esfuerzo: 'low',
        etiqueta: 'apa-extract',
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'No se pudo interpretar el texto' }, { status: 502 });
    }

    const clean = sanitizeApaExtraction(parsed);
    if (!clean) return NextResponse.json({ error: 'No se pudo reconocer un tipo de referencia válido' }, { status: 422 });

    return NextResponse.json({ data: clean });
  } catch (err: any) {
    console.error('APA extract error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
