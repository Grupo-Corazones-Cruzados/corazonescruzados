/**
 * EL ENLACE DE PAGO DE UN PROYECTO — canal 3.
 *
 * «el responsable del proyecto tenga un botón para compartir el enlace de pago… antes debe
 * pedir el correo del cliente o usar el correo del cliente que está asociado al ticket o
 * proyecto… el usuario miembro responsable define el tiempo máximo de duración del token»
 * (Fernando, 2026-08-25).
 *
 * Solo hace tres cosas: comprobar quién pide, traducir la petición y responder. **La lógica
 * vive en `lib/pagos/enlaces.ts`**, compartida con el endpoint de tickets, para que no
 * existan dos generadores de llaves de cobro que se separen con el tiempo.
 */
import { NextRequest, NextResponse } from 'next/server';
import { autorizarCompartir, SinAcceso } from '@/lib/pagos/acceso';
import { crearEnlaceDePago, listarEnlaces, revocarEnlace } from '@/lib/pagos/enlaces';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await autorizarCompartir(id, 'project');
    return NextResponse.json({ data: await listarEnlaces('project', String(id)) });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId } = await autorizarCompartir(id, 'project');
    const cuerpo = await req.json();

    const enlace = await crearEnlaceDePago({
      sourceType: 'project',
      sourceId: String(id),
      stageId: Number(cuerpo.stage_id) || null,
      email: cuerpo.email,
      horas: Number(cuerpo.horas),
      // Sin etapa = el proyecto entero (proyectos sin plan). `enviar: false` = solo generar.
      enviar: cuerpo.enviar !== false,
      createdBy: userId,
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin,
    });

    return NextResponse.json({ ok: true, ...enlace });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await autorizarCompartir(id, 'project');
    const linkId = Number(req.nextUrl.searchParams.get('link_id'));
    if (!linkId) return NextResponse.json({ error: 'Falta el enlace.' }, { status: 400 });
    const ok = await revocarEnlace('project', String(id), linkId);
    if (!ok) return NextResponse.json({ error: 'El enlace no existe o ya estaba anulado.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
