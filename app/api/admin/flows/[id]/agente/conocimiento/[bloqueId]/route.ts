import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { pool } from '@/lib/db';
import { asegurarCanal } from '@/lib/agente/canales';

/**
 * Resuelve el bloque filtrando TAMBIÉN por canal: con el id de un bloque de otro flujo
 * se responde 404 en vez de escribir donde no toca. Es el mismo scoping que se aplicó a
 * las campañas de correo tras encontrar el agujero allí.
 */
async function bloqueDelFlujo(flowId: string, bloqueId: string) {
  const { rows: [flujo] } = await pool.query(
    `SELECT id, type FROM gcc_world.flows WHERE id = $1`, [flowId],
  );
  if (flujo?.type !== 'ai_agent') return null;
  const canal = await asegurarCanal(flujo.id);
  const { rows: [bloque] } = await pool.query(
    `SELECT * FROM gcc_world.agente_conocimiento WHERE id = $1 AND canal_id = $2`,
    [bloqueId, canal.id],
  );
  return bloque ?? null;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; bloqueId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id, bloqueId } = await params;
  const bloque = await bloqueDelFlujo(id, bloqueId);
  if (!bloque) return NextResponse.json({ error: 'Bloque no encontrado' }, { status: 404 });

  const body = await req.json();
  const { rows: [fila] } = await pool.query(
    `UPDATE gcc_world.agente_conocimiento
        SET titulo = COALESCE($2, titulo), contenido = COALESCE($3, contenido),
            orden = COALESCE($4, orden), activo = COALESCE($5, activo), updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [
      bloqueId,
      typeof body.titulo === 'string' ? body.titulo.trim() : null,
      typeof body.contenido === 'string' ? body.contenido : null,
      typeof body.orden === 'number' ? body.orden : null,
      typeof body.activo === 'boolean' ? body.activo : null,
    ],
  );
  return NextResponse.json({ data: fila });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; bloqueId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id, bloqueId } = await params;
  const bloque = await bloqueDelFlujo(id, bloqueId);
  if (!bloque) return NextResponse.json({ error: 'Bloque no encontrado' }, { status: 404 });

  await pool.query(`DELETE FROM gcc_world.agente_conocimiento WHERE id = $1`, [bloqueId]);
  return NextResponse.json({ ok: true });
}
