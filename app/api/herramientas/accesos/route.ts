import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { esEquipo } from '@/lib/enlaces';
import { asegurarTablaAccesos, COMPARTIBLES, estadoDe, nuevoToken, urlAcceso } from '@/lib/herramientas/accesos';
import { sendAccesoHerramientaEmail } from '@/lib/integrations/email';

/**
 * GET /api/herramientas/accesos — los accesos compartidos: los míos, o todos si soy admin.
 * POST /api/herramientas/accesos — comparte una herramienta y, si viene `email`, lo manda por correo.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  if (!esEquipo(user.role)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  await asegurarTablaAccesos();
  const { rows } = await pool.query(
    `SELECT a.id, a.token, a.herramienta, a.titulo, a.client_id, a.exige_cuenta, a.estado, a.vence_en,
            a.enviado_a, a.creado_en, a.usos, a.ultimo_uso, a.cerrado_en, a.creado_por,
            COALESCE(c.name, c.full_name) AS cliente_nombre,
            NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS creador_nombre
       FROM gcc_world.herramienta_accesos a
       LEFT JOIN gcc_world.clients c ON c.id = a.client_id
       LEFT JOIN gcc_world.users u ON u.id = a.creado_por
      WHERE ($1::boolean OR a.creado_por = $2::uuid)
      ORDER BY a.creado_en DESC`,
    [user.role === 'admin', String(user.userId)],
  );
  const data = rows.map((r: any) => ({
    ...r, estado: estadoDe(r), url: urlAcceso(r.token), token: undefined,
    herramienta_nombre: COMPARTIBLES[r.herramienta]?.nombre || r.herramienta,
  }));
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  if (!esEquipo(user.role)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const herramienta = String(b.herramienta || '');
  if (!COMPARTIBLES[herramienta]) return NextResponse.json({ error: 'Esa herramienta no se puede compartir' }, { status: 400 });
  const titulo = String(b.titulo || '').trim().slice(0, 200);
  const horas = Math.min(Math.max(Number(b.horas) || 168, 1), 8760);
  const email = b.email ? String(b.email).trim().toLowerCase() : '';
  const exigeCuenta = !!b.exige_cuenta;
  const clientId = exigeCuenta ? Number(b.client_id) || null : null;

  if (exigeCuenta) {
    if (!clientId) return NextResponse.json({ error: 'Elige el cliente que debe iniciar sesión' }, { status: 400 });
    const { rows: [c] } = await pool.query(
      `SELECT 1 FROM gcc_world.clients c JOIN gcc_world.users u ON u.id = c.user_id
        WHERE c.id = $1 AND c.account_type = 'client'`,
      [clientId],
    );
    if (!c) return NextResponse.json({ error: 'Ese cliente no tiene cuenta en GCC World' }, { status: 400 });
  }

  await asegurarTablaAccesos();
  const token = nuevoToken();
  const venceEn = new Date(Date.now() + horas * 3600 * 1000);
  const { rows: [a] } = await pool.query(
    `INSERT INTO gcc_world.herramienta_accesos (token, herramienta, titulo, client_id, exige_cuenta, vence_en, enviado_a, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [token, herramienta, titulo, clientId, exigeCuenta, venceEn, email || null, String(user.userId)],
  );
  const url = urlAcceso(token);

  let enviado = false;
  if (email) {
    try {
      const { rows: [u] } = await pool.query(
        `SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') AS nombre FROM gcc_world.users WHERE id = $1`,
        [String(user.userId)],
      );
      await sendAccesoHerramientaEmail({
        email, herramienta: COMPARTIBLES[herramienta].nombre, titulo, url, vence: venceEn, remitente: u?.nombre || undefined, exigeCuenta,
      });
      enviado = true;
    } catch (err: any) { console.error('[accesos] no salió el correo', err?.message); }
  }
  return NextResponse.json({ data: { id: a.id, url, enviado } });
}
