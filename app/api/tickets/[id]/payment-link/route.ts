/**
 * EL ENLACE DE PAGO DE UN TICKET — canal 3 (2026-08-26).
 *
 * Gemelo del de proyectos y **con la misma lógica detrás** (`lib/pagos/enlaces.ts`): lo
 * único que cambia es el origen y quién puede compartirlo (aquí, el miembro asignado al
 * ticket).
 *
 * ⚠️ Un ticket **no lleva `stage_id`**: se cobra entero, una sola vez. El candado que lo
 * impide repetir es el índice `idx_payment_intents_origen_pagado` de la migración 054,
 * porque el de `stage_id` no cubre las filas donde es NULL.
 */
import { NextRequest, NextResponse } from 'next/server';
import { autorizarCompartir, SinAcceso } from '@/lib/pagos/acceso';
import { crearEnlaceDePago, listarEnlaces, revocarEnlace } from '@/lib/pagos/enlaces';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await autorizarCompartir(id, 'ticket');
    return NextResponse.json({ data: await listarEnlaces('ticket', String(id)) });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId } = await autorizarCompartir(id, 'ticket');
    const cuerpo = await req.json();

    const enlace = await crearEnlaceDePago({
      sourceType: 'ticket',
      sourceId: String(id),
      stageId: null,
      email: cuerpo.email,
      horas: Number(cuerpo.horas),
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
    await autorizarCompartir(id, 'ticket');
    const linkId = Number(req.nextUrl.searchParams.get('link_id'));
    if (!linkId) return NextResponse.json({ error: 'Falta el enlace.' }, { status: 400 });
    const ok = await revocarEnlace('ticket', String(id), linkId);
    if (!ok) return NextResponse.json({ error: 'El enlace no existe o ya estaba anulado.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
