/**
 * Qué listas usa una plantilla. Es lo que escribe la casilla de cada lista.
 *
 * Mismo modelo que campañas ↔ listas en el correo masivo: una lista sirve para varias
 * plantillas y una plantilla se manda a varias listas.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser, type TokenPayload } from '@/lib/auth/jwt';
import { flujoPermitido } from '@/lib/flows/acceso';
import { pool } from '@/lib/db';
import { asegurarCanal } from '@/lib/agente/canales';

async function contexto(user: TokenPayload | null, flowId: string, plantillaId: string) {
  const flujo = await flujoPermitido(user, flowId);
  if (flujo?.type !== 'ai_agent') return null;
  const canal = await asegurarCanal(flujo.id);
  const { rows: [p] } = await pool.query(
    `SELECT id FROM gcc_world.agente_plantillas WHERE id = $1 AND canal_id = $2`,
    [plantillaId, canal.id],
  );
  return p ? { flujo, plantilla: p } : null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; plantillaId: string }> }) {
  const user = await getCurrentUser();
  const { id, plantillaId } = await params;
  const ctx = await contexto(user, id, plantillaId);
  if (!ctx) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const { lista_id, asociar } = await req.json();
  if (!lista_id) return NextResponse.json({ error: 'Falta la lista' }, { status: 400 });

  // ⚠️ La lista tiene que ser de ESTE flujo. Sin esta comprobación, un identificador
  // escrito a mano asociaría la plantilla de un cliente a los contactos de otro.
  const { rows: [lista] } = await pool.query(
    `SELECT id FROM gcc_world.flow_contact_lists WHERE id = $1 AND flow_id = $2`,
    [lista_id, ctx.flujo.id],
  );
  if (!lista) return NextResponse.json({ error: 'Esa lista no es de este flujo.' }, { status: 404 });

  if (asociar) {
    await pool.query(
      `INSERT INTO gcc_world.agente_plantilla_listas (plantilla_id, lista_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [ctx.plantilla.id, lista_id],
    );
  } else {
    await pool.query(
      `DELETE FROM gcc_world.agente_plantilla_listas WHERE plantilla_id = $1 AND lista_id = $2`,
      [ctx.plantilla.id, lista_id],
    );
  }

  return NextResponse.json({ ok: true });
}
