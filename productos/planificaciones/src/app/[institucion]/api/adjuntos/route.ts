import { NextResponse } from 'next/server';
import { contextoApi } from '@/lib/inquilino';
import { iaConfigurada } from '@/lib/ia';
import { guardarAdjunto } from '@/lib/adjuntos';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Subir un adjunto de la solicitud: se le saca el texto y se convierte en
 * embeddings en el acto (Fernando, 2026-09-15: «al ser agregados deben
 * convertirse en embeddings»). Devuelve su id, que el formulario manda al crear
 * la semana. En un escaparate no se guarda nada.
 */
export async function POST(peticion: Request, { params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const ctx = await contextoApi(institucion, 'planificar');
  if (!ctx) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 });
  if (ctx.inquilino.soloLectura) return NextResponse.json({ error: 'Esto es una demostración: los adjuntos no se guardan.' }, { status: 403 });
  if (!iaConfigurada()) return NextResponse.json({ error: 'Los adjuntos no están configurados (falta la clave de IA).' }, { status: 503 });

  const datos = await peticion.formData();
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size) return NextResponse.json({ error: 'Elige un archivo.' }, { status: 400 });

  const r = await guardarAdjunto({ inquilinoId: ctx.inquilino.id, usuarioId: ctx.sesion.uid, archivo });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json(r.adjunto);
}

/** Quitar un adjunto todavía suelto (antes de enviar la solicitud). */
export async function DELETE(peticion: Request, { params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const ctx = await contextoApi(institucion, 'planificar');
  if (!ctx) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 });
  const id = Number(new URL(peticion.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
  await prisma.adjunto.deleteMany({ where: { id, usuarioId: ctx.sesion.uid, inquilinoId: ctx.inquilino.id, semanaId: null } });
  return NextResponse.json({ ok: true });
}
