import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { deleteContenido, getContenido, updateContenido } from '@/lib/centralized/generacion-contenido-db';
import { isEstado, isFuenteTipo, isReferenciaTipo } from '@/lib/centralized/generacion-contenido';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return { userId: user.userId, isAdmin: user.role === 'admin' };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    const data = await getContenido(Number(id), g.userId, g.isAdmin);
    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Generación de contenido detalle error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    const body = await req.json();
    const patch: any = {};
    if (body.tema !== undefined) patch.tema = String(body.tema);
    if (body.proposito_social !== undefined) patch.proposito_social = String(body.proposito_social);
    if (body.proposito_monetario !== undefined) patch.proposito_monetario = String(body.proposito_monetario);
    if (body.desarrollo !== undefined) patch.desarrollo = String(body.desarrollo);
    if (body.talento !== undefined) patch.talento = body.talento ? String(body.talento) : null;
    if (body.titulo !== undefined) patch.titulo = String(body.titulo);
    if (body.estado !== undefined) {
      if (!isEstado(String(body.estado))) return NextResponse.json({ error: 'Estado desconocido.' }, { status: 400 });
      patch.estado = body.estado;
    }
    if (Array.isArray(body.tonos)) patch.tonos = body.tonos.map(String);
    if (Array.isArray(body.referencias)) {
      patch.referencias = body.referencias
        .filter((r: any) => isReferenciaTipo(r?.tipo) && Number(r?.ref_id))
        .map((r: any) => ({ tipo: r.tipo, ref_id: Number(r.ref_id), titulo: String(r.titulo ?? '') }));
    }
    if (Array.isArray(body.fuentes)) {
      patch.fuentes = body.fuentes
        .filter((f: any) => isFuenteTipo(f?.tipo) && Number(f?.ref_id))
        .map((f: any) => ({ tipo: f.tipo, ref_id: Number(f.ref_id), etiqueta: String(f.etiqueta ?? '') }));
    }

    const ok = await updateContenido(Number(id), g.userId, g.isAdmin, patch);
    if (!ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: await getContenido(Number(id), g.userId, g.isAdmin) });
  } catch (err: any) {
    console.error('Generación de contenido PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    const ok = await deleteContenido(Number(id), g.userId, g.isAdmin);
    if (!ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Generación de contenido DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
