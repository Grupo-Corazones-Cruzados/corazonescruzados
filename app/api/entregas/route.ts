import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { esEquipo, nuevoToken } from '@/lib/enlaces';
import { asegurarTablaEntregas, estadoEntrega, purgarBorradores, urlEntrega } from '@/lib/entregas';

/**
 * GET /api/entregas — las entregas de un solo uso: las mías, o todas si soy admin (sin borradores).
 * POST /api/entregas — abre un BORRADOR (`preparando`) para ir subiendo los archivos; se publica
 * con `/api/entregas/<id>/publicar`. Ver `lib/entregas`.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  if (!esEquipo(user.role)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  await asegurarTablaEntregas();
  purgarBorradores().catch((e) => console.error('[entregas] purga', e?.message));
  const { rows } = await pool.query(
    `SELECT e.id, e.token, e.titulo, e.mensaje, e.client_id, e.exige_cuenta, e.estado, e.vence_en, e.enviado_a,
            e.creado_en, e.archivos, e.abierto_en, e.descargas, e.cerrado_en, e.creado_por,
            COALESCE(c.name, c.full_name) AS cliente_nombre,
            NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS creador_nombre,
            au.email AS abierto_por_email
       FROM gcc_world.entregas_unicas e
       LEFT JOIN gcc_world.clients c ON c.id = e.client_id
       LEFT JOIN gcc_world.users u ON u.id = e.creado_por
       LEFT JOIN gcc_world.users au ON au.id = e.abierto_por
      WHERE e.estado <> 'preparando' AND ($1::boolean OR e.creado_por = $2::uuid)
      ORDER BY e.creado_en DESC`,
    [user.role === 'admin', String(user.userId)],
  );
  const data = rows.map((r: any) => ({ ...r, estado: estadoEntrega(r), url: urlEntrega(r.token), token: undefined }));
  return NextResponse.json({ data });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  if (!esEquipo(user.role)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  await asegurarTablaEntregas();
  const { rows: [e] } = await pool.query(
    `INSERT INTO gcc_world.entregas_unicas (token, creado_por) VALUES ($1, $2) RETURNING id`,
    [nuevoToken(), String(user.userId)],
  );
  return NextResponse.json({ data: { id: e.id } });
}
