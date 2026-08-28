/** El hilo de UNA conversación. Aquí sí van los mensajes. */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { pool } from '@/lib/db';
import { conversacionDelFlujo } from '@/lib/agente/bandeja';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; convId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id, convId } = await params;
  const encontrada = await conversacionDelFlujo(user, id, convId);
  if (!encontrada) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });

  const { rows: mensajes } = await pool.query(
    `SELECT id, direccion, texto, tipo, herramienta, motivo, enviado_ok, error_envio, created_at
       FROM gcc_world.agente_mensajes
      WHERE conversacion_id = $1 ORDER BY created_at ASC LIMIT 500`,
    [convId],
  );
  const { rows: [gasto] } = await pool.query(
    `SELECT COALESCE(SUM(tokens_entrada),0)::int AS entrada,
            COALESCE(SUM(tokens_salida),0)::int AS salida,
            COALESCE(SUM(tokens_cache_lectura),0)::int AS cache_lectura,
            COUNT(*)::int AS corridas
       FROM gcc_world.agente_uso_modelo WHERE conversacion_id = $1`,
    [convId],
  );

  const { conv } = encontrada;
  return NextResponse.json({
    data: {
      conversacion: {
        id: conv.id, wa_id: conv.wa_id, nombre_perfil: conv.nombre_perfil, nombre_agenda: conv.nombre_agenda,
        bot_activo: conv.bot_activo, motivo_escalado: conv.motivo_escalado,
        resumen: conv.resumen, ultimo_mensaje_en: conv.ultimo_mensaje_en,
      },
      mensajes,
      // `cache_lectura` en cero tras varias corridas significa que el prefijo no llega
      // al mínimo del modelo: se está pagando el prompt entero cada vez.
      gasto,
    },
  });
}
