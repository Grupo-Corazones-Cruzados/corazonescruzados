import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { getPrompts, setPrompt } from '@/lib/centralized/generacion-contenido-db';
import { CLAVES_PROMPT, promptPorDefecto } from '@/lib/centralized/generacion-contenido';

// El prompt del agente es un DATO, no código: se edita aquí y no hace falta un despliegue
// para cambiar la voz de un entregable.
async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return { userId: user.userId };
}

export async function GET() {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const actuales = await getPrompts();
    const porDefecto: Record<string, string> = {};
    for (const c of CLAVES_PROMPT) porDefecto[c] = promptPorDefecto(c);
    return NextResponse.json({ data: { prompts: actuales, porDefecto } });
  } catch (err: any) {
    console.error('Generación de contenido prompts GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { clave, texto } = await req.json();
    if (!CLAVES_PROMPT.includes(clave)) return NextResponse.json({ error: 'Prompt desconocido.' }, { status: 400 });
    if (typeof texto !== 'string' || !texto.trim()) {
      return NextResponse.json({ error: 'El prompt no puede quedar vacío.' }, { status: 400 });
    }
    await setPrompt(clave, texto, g.userId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Generación de contenido prompts PUT error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
