/**
 * Los tres prompts del agente, versionados.
 *
 * Al guardar NO se sobrescribe: se desactiva la versión anterior y se inserta una nueva.
 * El índice único parcial de la tabla garantiza que solo haya una activa por tipo, así
 * que el historial queda intacto y se puede volver atrás.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser, type TokenPayload } from '@/lib/auth/jwt';
import { flujoPermitido } from '@/lib/flows/acceso';
import { pool } from '@/lib/db';
import { asegurarCanal } from '@/lib/agente/canales';

const TIPOS = ['perfil_agente', 'reglas_negocio', 'resumen_conversacion'] as const;
type Tipo = (typeof TIPOS)[number];

/**
 * ⚠️ El flujo se busca por `flujoPermitido()`, no con un `SELECT` directo: además de
 * traerlo, comprueba que ESTE usuario pueda verlo. Antes bastaba con tener sesión, y eso
 * dejaba a un cliente entrar al agente de otro escribiendo su identificador en la URL.
 */
async function canalDelFlujo(user: TokenPayload | null, id: string) {
  const flujo = await flujoPermitido(user, id);
  if (flujo?.type !== 'ai_agent') return null;
  return asegurarCanal(flujo.id);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const canal = await canalDelFlujo(user, id);
  if (!canal) return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });

  const { rows } = await pool.query(
    `SELECT tipo, version, contenido, created_at FROM gcc_world.agente_prompts
      WHERE canal_id = $1 AND activo`, [canal.id],
  );
  const { rows: historial } = await pool.query(
    `SELECT tipo, COUNT(*)::int AS versiones FROM gcc_world.agente_prompts
      WHERE canal_id = $1 GROUP BY tipo`, [canal.id],
  );
  const cuenta = Object.fromEntries(historial.map((h: any) => [h.tipo, h.versiones]));

  const data = TIPOS.map((tipo) => {
    const actual = rows.find((r: any) => r.tipo === tipo);
    return {
      tipo,
      version: actual?.version ?? 0,
      contenido: actual?.contenido ?? '',
      caracteres: (actual?.contenido ?? '').length,
      versiones: cuenta[tipo] ?? 0,
      actualizado: actual?.created_at ?? null,
    };
  });
  return NextResponse.json({ data });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const canal = await canalDelFlujo(user, id);
  if (!canal) return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });

  const { tipo, contenido } = await req.json();
  if (!TIPOS.includes(tipo as Tipo)) {
    return NextResponse.json({ error: `Tipo de prompt desconocido: ${tipo}` }, { status: 400 });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: [previa] } = await cliente.query(
      `SELECT MAX(version)::int AS v FROM gcc_world.agente_prompts WHERE canal_id = $1 AND tipo = $2`,
      [canal.id, tipo],
    );
    // Primero se apaga la activa; el índice único parcial no admite dos a la vez.
    await cliente.query(
      `UPDATE gcc_world.agente_prompts SET activo = false WHERE canal_id = $1 AND tipo = $2 AND activo`,
      [canal.id, tipo],
    );
    const { rows: [fila] } = await cliente.query(
      `INSERT INTO gcc_world.agente_prompts (canal_id, tipo, version, contenido)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [canal.id, tipo, (previa?.v ?? 0) + 1, String(contenido ?? '')],
    );
    await cliente.query('COMMIT');
    return NextResponse.json({ data: fila });
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}
