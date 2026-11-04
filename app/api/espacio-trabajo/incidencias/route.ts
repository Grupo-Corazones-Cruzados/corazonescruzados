import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { llamarServicio, rechazo } from '@/lib/espacio-trabajo/guardia';

export const dynamic = 'force-dynamic';

/**
 * Lo que escriben los clientes al WhatsApp del NEGOCIO DE GCC.
 *
 * ⚠️ El inquilino va escrito en la consulta y no se recibe de fuera: los demás (Peter Tours…) son
 * conversaciones de otros negocios y no se pueden leer desde aquí de ninguna manera. Es una sola
 * SELECT, no escribe nada. El número se conecta por coexistencia en el producto Automatizaciones,
 * dentro de `/grupo`; al hacerlo, aparece aquí sin tocar código.
 */
const INQUILINO = 'grupo';

export async function GET(req: Request) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const { rows } = await pool.query(`
    SELECT k.id, k.canal_id AS canal, c.id AS contacto, c.wa_id AS "waId",
           COALESCE(NULLIF(c.nombre_agenda, ''), NULLIF(c.nombre_perfil, ''), c.wa_id) AS nombre,
           k.ultimo_mensaje_en AS ultimo, ca.numero_visible AS numero, ca.nombre_verificado AS negocio, ca.bot_activo AS bot,
           m.mensajes
      FROM automatizaciones.conversaciones k
      JOIN automatizaciones.inquilinos i ON i.id = k.inquilino_id AND i.slug = $1
      JOIN automatizaciones.contactos c ON c.id = k.contacto_id
      JOIN automatizaciones.canales ca ON ca.id = k.canal_id
      CROSS JOIN LATERAL (
        SELECT json_agg(x ORDER BY x.id) AS mensajes FROM (
          SELECT id, direccion::text AS direccion, tipo, texto, creado_en AS en
            FROM automatizaciones.mensajes
           WHERE conversacion_id = k.id
           ORDER BY id DESC LIMIT 40
        ) x
      ) m
     WHERE EXISTS (SELECT 1 FROM automatizaciones.mensajes e WHERE e.conversacion_id = k.id AND e.direccion = 'ENTRANTE')
     ORDER BY k.ultimo_mensaje_en DESC NULLS LAST
     LIMIT 100`, [INQUILINO]);
  let estado = { conversaciones: {}, contactos: {} };
  try {
    const r = await llamarServicio('/incidencias/estado');
    if (r.ok) estado = await r.json();
  } catch { /* sin servicio se ven igual; lo dice la pantalla al intentar enviar */ }
  return NextResponse.json({ conversaciones: rows, estado });
}
