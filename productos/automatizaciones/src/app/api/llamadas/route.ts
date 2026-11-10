import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { leerSesionUsuario } from '@/lib/sesion';
import { contextoApi } from '@/lib/inquilino';

export const dynamic = 'force-dynamic';

/**
 * LO QUE ESTÁ SONANDO (2026-11-10). Lo pregunta cada pocos segundos el aviso de llamadas del
 * panel (`componentes/Llamadas.tsx`), solo en negocios con algún número que recibe llamadas.
 *
 * Devuelve las que suenan AHORA (las de hace más de 70 s ya no se pueden contestar: Meta da entre
 * 30 y 60 s) con su oferta SDP, y el estado de la llamada que este navegador lleva (`?activa=`),
 * para saber si el contacto colgó.
 */
export async function GET(req: Request) {
  const sesion = await leerSesionUsuario();
  if (!sesion) return NextResponse.json({ sonando: [], activa: null }, { status: 401 });
  const ctx = await contextoApi(sesion.slug, 'OPERADOR');
  if (!ctx) return NextResponse.json({ sonando: [], activa: null }, { status: 403 });

  const { rows: sonando } = await pool.query(
    `SELECT l.id, l.sdp_oferta AS sdp, l.conversacion_id AS "conversacionId",
            COALESCE(ct.nombre_agenda, ct.nombre_perfil, ct.wa_id) AS nombre, ct.wa_id AS numero,
            ca.numero_visible AS "numeroNegocio"
       FROM llamadas l
       JOIN canales ca ON ca.id = l.canal_id
       LEFT JOIN conversaciones cv ON cv.id = l.conversacion_id
       LEFT JOIN contactos ct ON ct.id = cv.contacto_id
      WHERE l.inquilino_id = $1 AND l.estado = 'SONANDO' AND l.llego_en > NOW() - INTERVAL '70 seconds'
      ORDER BY l.llego_en`,
    [ctx.inquilino.id],
  );
  const activaId = Number(new URL(req.url).searchParams.get('activa')) || null;
  const { rows: [activa] } = activaId
    ? await pool.query(`SELECT id, estado FROM llamadas WHERE id = $1 AND inquilino_id = $2`, [activaId, ctx.inquilino.id])
    : { rows: [] };
  return NextResponse.json({ sonando, activa: activa ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
