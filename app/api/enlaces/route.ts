import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { asegurarTablaEnlaces, esEquipo, estadoDe, nuevoToken, urlEnlace } from '@/lib/enlaces';
import { sendEnlaceUnicoEmail } from '@/lib/integrations/email';

/**
 * GET /api/enlaces — los enlaces de un solo uso: los míos, o todos si soy admin.
 * POST /api/enlaces — genera uno y, si viene `email`, lo manda por correo.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  if (!esEquipo(user.role)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  await asegurarTablaEnlaces();
  const { rows } = await pool.query(
    `SELECT e.id, e.token, e.titulo, e.indicaciones, e.client_id, e.exige_cuenta, e.estado, e.vence_en,
            e.enviado_a, e.creado_en, e.respuesta, e.archivos, e.respondido_en, e.cerrado_en, e.creado_por,
            COALESCE(c.name, c.full_name) AS cliente_nombre,
            NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS creador_nombre,
            ru.email AS respondido_por_email
       FROM gcc_world.enlaces_unicos e
       LEFT JOIN gcc_world.clients c ON c.id = e.client_id
       LEFT JOIN gcc_world.users u ON u.id = e.creado_por
       LEFT JOIN gcc_world.users ru ON ru.id = e.respondido_por
      WHERE ($1::boolean OR e.creado_por = $2::uuid)
      ORDER BY e.creado_en DESC`,
    [user.role === 'admin', String(user.userId)],
  );
  const data = rows.map((r: any) => ({ ...r, estado: estadoDe(r), url: urlEnlace(r.token), token: undefined }));
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  if (!esEquipo(user.role)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const titulo = String(b.titulo || '').trim().slice(0, 200);
  const indicaciones = String(b.indicaciones || '').trim().slice(0, 4000);
  const horas = Math.min(Math.max(Number(b.horas) || 168, 1), 8760);
  const email = b.email ? String(b.email).trim().toLowerCase() : '';
  const exigeCuenta = !!b.exige_cuenta;
  const clientId = exigeCuenta ? Number(b.client_id) || null : null;
  if (!titulo) return NextResponse.json({ error: 'Ponle un título al enlace' }, { status: 400 });

  let cliente: { email: string | null } | null = null;
  if (exigeCuenta) {
    if (!clientId) return NextResponse.json({ error: 'Elige el cliente que debe iniciar sesión' }, { status: 400 });
    const { rows: [c] } = await pool.query(
      `SELECT u.email FROM gcc_world.clients c JOIN gcc_world.users u ON u.id = c.user_id
        WHERE c.id = $1 AND c.account_type = 'client'`,
      [clientId],
    );
    if (!c) return NextResponse.json({ error: 'Ese cliente no tiene cuenta en GCC World' }, { status: 400 });
    cliente = c;
  }

  await asegurarTablaEnlaces();
  const token = nuevoToken();
  const venceEn = new Date(Date.now() + horas * 3600 * 1000);
  const { rows: [e] } = await pool.query(
    `INSERT INTO gcc_world.enlaces_unicos (token, titulo, indicaciones, client_id, exige_cuenta, vence_en, enviado_a, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [token, titulo, indicaciones, clientId, exigeCuenta, venceEn, email || null, String(user.userId)],
  );
  const url = urlEnlace(token);

  let enviado = false;
  if (email) {
    try {
      const { rows: [u] } = await pool.query(
        `SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') AS nombre FROM gcc_world.users WHERE id = $1`,
        [String(user.userId)],
      );
      await sendEnlaceUnicoEmail({ email, titulo, indicaciones, url, remitente: u?.nombre || undefined, exigeCuenta });
      enviado = true;
    } catch (err: any) { console.error('[enlaces] no salió el correo', err?.message); }
  }
  return NextResponse.json({ data: { id: e.id, url, enviado, cliente_email: cliente?.email ?? null } });
}
