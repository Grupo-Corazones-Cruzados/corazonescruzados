/**
 * Bloques de conocimiento del canal. Entran COMPLETOS en el prompt cacheado: no hay
 * búsqueda ni embeddings (decisión cerrada).
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { pool } from '@/lib/db';
import { asegurarCanal } from '@/lib/agente/canales';
import { estaPendiente, estaVacio, type BloqueConocimiento } from '@/lib/agente/conocimiento';

async function canalDelFlujo(id: string) {
  const { rows: [flujo] } = await pool.query(
    `SELECT id, type FROM gcc_world.flows WHERE id = $1`, [id],
  );
  if (flujo?.type !== 'ai_agent') return null;
  return asegurarCanal(flujo.id);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const canal = await canalDelFlujo(id);
  if (!canal) return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });

  const { rows } = await pool.query(
    `SELECT id, clave, titulo, contenido, orden, activo FROM gcc_world.agente_conocimiento
      WHERE canal_id = $1 ORDER BY orden, clave`, [canal.id],
  );
  // El estado de cada bloque se calcula, no se guarda: así no puede quedar desfasado.
  const data = rows.map((b: any) => ({
    ...b,
    caracteres: (b.contenido ?? '').length,
    pendiente: estaVacio(b as BloqueConocimiento) || estaPendiente(b as BloqueConocimiento),
  }));
  return NextResponse.json({ data });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const canal = await canalDelFlujo(id);
  if (!canal) return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });

  const { clave, titulo, contenido, orden } = await req.json();
  const limpia = String(clave ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!limpia) return NextResponse.json({ error: 'La clave es obligatoria' }, { status: 400 });
  if (!String(titulo ?? '').trim()) return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });

  try {
    const { rows: [fila] } = await pool.query(
      `INSERT INTO gcc_world.agente_conocimiento (canal_id, clave, titulo, contenido, orden)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [canal.id, limpia, String(titulo).trim(), String(contenido ?? ''), Number(orden) || 0],
    );
    return NextResponse.json({ data: fila }, { status: 201 });
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: `Ya existe un bloque con la clave «${limpia}»` }, { status: 409 });
    }
    throw err;
  }
}
