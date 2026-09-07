import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import {
  createContenido, listContenidos, memberIdDeUsuario,
} from '@/lib/centralized/generacion-contenido-db';
import { isFuenteTipo, isReferenciaTipo } from '@/lib/centralized/generacion-contenido';

// Sistema «Generación de Contenido» (Centralizado · colaborador · gestión).
// Las ideas son PRIVADAS por colaborador; el admin las ve todas. El alcance lo fuerza la
// capa de datos, no esta ruta: aquí solo se dice QUIÉN pregunta.
async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return { userId: user.userId, isAdmin: user.role === 'admin' };
}

export async function GET() {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    return NextResponse.json({ data: await listContenidos(g.userId, g.isAdmin) });
  } catch (err: any) {
    console.error('Generación de contenido GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const body = await req.json();
    if (!body?.tema?.trim()) return NextResponse.json({ error: 'El tema es obligatorio.' }, { status: 400 });

    const memberId = await memberIdDeUsuario(g.userId);
    const { id } = await createContenido(g.userId, memberId, {
      tema: String(body.tema).trim(),
      proposito_social: String(body.proposito_social ?? ''),
      proposito_monetario: String(body.proposito_monetario ?? ''),
      desarrollo: String(body.desarrollo ?? ''),
      talento: body.talento ? String(body.talento) : null,
      tonos: Array.isArray(body.tonos) ? body.tonos.map(String) : [],
      referencias: (Array.isArray(body.referencias) ? body.referencias : [])
        .filter((r: any) => isReferenciaTipo(r?.tipo) && Number(r?.ref_id))
        .map((r: any) => ({ tipo: r.tipo, ref_id: Number(r.ref_id), titulo: String(r.titulo ?? '') })),
      fuentes: (Array.isArray(body.fuentes) ? body.fuentes : [])
        .filter((f: any) => isFuenteTipo(f?.tipo) && Number(f?.ref_id))
        .map((f: any) => ({ tipo: f.tipo, ref_id: Number(f.ref_id), etiqueta: String(f.etiqueta ?? '') })),
    });
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (err: any) {
    console.error('Generación de contenido POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
