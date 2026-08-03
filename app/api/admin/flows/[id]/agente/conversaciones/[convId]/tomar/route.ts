/**
 * La TOMA HUMANA: apagar el bot en ESTA conversación, sin tocar el resto del canal.
 * `tomar: false` se la devuelve al agente.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { pool } from '@/lib/db';
import { conversacionDelFlujo } from '@/lib/agente/bandeja';

export async function POST(req: Request, { params }: { params: Promise<{ id: string; convId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id, convId } = await params;
  const encontrada = await conversacionDelFlujo(user, id, convId);
  if (!encontrada) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });

  const { tomar, motivo } = await req.json().catch(() => ({ tomar: true, motivo: null }));
  const laTomo = tomar !== false;

  const { rows: [fila] } = await pool.query(
    `UPDATE gcc_world.agente_conversaciones
        SET bot_activo = $2,
            tomada_por = $3,
            tomada_en  = CASE WHEN $2 THEN NULL ELSE NOW() END,
            motivo_escalado = CASE WHEN $2 THEN NULL ELSE COALESCE($4, motivo_escalado) END,
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, bot_activo, motivo_escalado`,
    [convId, !laTomo, laTomo ? user.userId : null, motivo ?? null],
  );

  // Al devolvérsela al agente se limpia cualquier trabajo en error de esa conversación,
  // para que el siguiente mensaje se pueda encolar sin arrastrar el fallo anterior.
  if (!laTomo) {
    await pool.query(
      `DELETE FROM gcc_world.agente_cola WHERE conversacion_id = $1 AND estado = 'error'`,
      [convId],
    );
  }

  return NextResponse.json({ data: fila });
}
