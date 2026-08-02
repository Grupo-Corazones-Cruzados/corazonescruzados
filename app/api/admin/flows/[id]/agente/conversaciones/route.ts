/**
 * La bandeja: las conversaciones de un canal, con lo justo para pintar la lista.
 *
 * ⚠️ NO devuelve los mensajes. Una bandeja con cien chats traería miles de filas de
 * texto para pintar cuatro líneas por fila. El hilo lo da el GET de UNA conversación.
 * Es la misma lección que dejó el listado de campañas: `SELECT *` sobre una tabla con
 * contenido pesado dejaba la pantalla colgada en «Cargando…».
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { pool } from '@/lib/db';
import { asegurarCanal } from '@/lib/agente/canales';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const { rows: [flujo] } = await pool.query(`SELECT id, type FROM gcc_world.flows WHERE id = $1`, [id]);
  if (flujo?.type !== 'ai_agent') return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });
  const canal = await asegurarCanal(flujo.id);

  const url = new URL(req.url);
  const filtro = url.searchParams.get('filtro'); // todas | humanas | bot
  const busca = (url.searchParams.get('q') ?? '').trim();

  const { rows } = await pool.query(
    `SELECT c.id, c.bot_activo, c.motivo_escalado, c.ultimo_mensaje_en, c.resumen IS NOT NULL AS tiene_resumen,
            ct.wa_id, ct.nombre_perfil,
            NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS tomada_por_nombre,
            (SELECT m.texto FROM gcc_world.agente_mensajes m
              WHERE m.conversacion_id = c.id AND m.texto <> '' ORDER BY m.created_at DESC LIMIT 1) AS ultimo_texto,
            (SELECT m.direccion FROM gcc_world.agente_mensajes m
              WHERE m.conversacion_id = c.id AND m.texto <> '' ORDER BY m.created_at DESC LIMIT 1) AS ultima_direccion,
            (SELECT COUNT(*)::int FROM gcc_world.agente_mensajes m WHERE m.conversacion_id = c.id) AS mensajes
       FROM gcc_world.agente_conversaciones c
       JOIN gcc_world.agente_contactos ct ON ct.id = c.contacto_id
       LEFT JOIN gcc_world.users u ON u.id = c.tomada_por
      WHERE c.canal_id = $1
        AND ($2::text IS NULL OR $2 = 'todas'
             OR ($2 = 'humanas' AND c.bot_activo = false)
             OR ($2 = 'bot' AND c.bot_activo = true))
        AND ($3 = '' OR ct.wa_id ILIKE '%'||$3||'%' OR COALESCE(ct.nombre_perfil,'') ILIKE '%'||$3||'%')
      ORDER BY c.ultimo_mensaje_en DESC NULLS LAST
      LIMIT 200`,
    [canal.id, filtro ?? 'todas', busca],
  );

  const { rows: [conteo] } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE bot_activo)::int AS bot,
            COUNT(*) FILTER (WHERE NOT bot_activo)::int AS humanas
       FROM gcc_world.agente_conversaciones WHERE canal_id = $1`,
    [canal.id],
  );

  return NextResponse.json({ data: rows, conteo, canal: { bot_activo: canal.bot_activo, estado: canal.estado } });
}
