import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { limpiarCarpeta, MAX_ARCHIVOS, MAX_TEXTO, verificarArchivos } from '@/lib/enlaces';
import { asegurarTablaEntregas, rutaEntrega, urlEntrega } from '@/lib/entregas';
import { sendEntregaUnicaEmail } from '@/lib/integrations/email';

export const runtime = 'nodejs';

/**
 * POST /api/entregas/<id>/publicar { titulo, mensaje, horas, email, exige_cuenta, client_id, archivos }
 * — el borrador pasa a `vigente` y devuelve el enlace; con `email`, sale el correo.
 *
 * Si ya estaba publicada (se pulsó «Generar enlace» y después «Generar y enviar»), no se toca:
 * solo se manda el correo con el mismo enlace.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const { id } = await params;
  await asegurarTablaEntregas();
  const { rows: [e] } = await pool.query(
    `SELECT id, token, estado, titulo, mensaje, exige_cuenta, subidas FROM gcc_world.entregas_unicas WHERE id = $1 AND creado_por = $2::uuid`,
    [Number(id), String(user.userId)],
  );
  if (!e) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const email = b.email ? String(b.email).trim().toLowerCase() : '';

  if (e.estado === 'preparando') {
    const titulo = String(b.titulo || '').trim().slice(0, 200);
    const mensaje = String(b.mensaje || '').trim().slice(0, MAX_TEXTO);
    const horas = Math.min(Math.max(Number(b.horas) || 168, 1), 8760);
    const exigeCuenta = !!b.exige_cuenta;
    const clientId = exigeCuenta ? Number(b.client_id) || null : null;
    const ids: string[] = Array.isArray(b.archivos) ? [...new Set(b.archivos.map(String))] as string[] : [];
    if (!titulo) return NextResponse.json({ error: 'Ponle un título a la entrega' }, { status: 400 });
    if (!mensaje && !ids.length) return NextResponse.json({ error: 'Escribe un mensaje o adjunta un archivo' }, { status: 400 });
    if (ids.length > MAX_ARCHIVOS) return NextResponse.json({ error: `Máximo ${MAX_ARCHIVOS} archivos` }, { status: 400 });
    if (exigeCuenta) {
      if (!clientId) return NextResponse.json({ error: 'Elige el cliente que debe iniciar sesión' }, { status: 400 });
      const { rows: [c] } = await pool.query(
        `SELECT 1 FROM gcc_world.clients c JOIN gcc_world.users u ON u.id = c.user_id WHERE c.id = $1 AND c.account_type = 'client'`, [clientId]);
      if (!c) return NextResponse.json({ error: 'Ese cliente no tiene cuenta en GCC World' }, { status: 400 });
    }
    let archivos;
    try { archivos = await verificarArchivos(rutaEntrega(e), ids); }
    catch (err: any) { return NextResponse.json({ error: err.message }, { status: 400 }); }

    const r = await pool.query(
      `UPDATE gcc_world.entregas_unicas
          SET estado = 'vigente', titulo = $2, mensaje = $3, vence_en = NOW() + make_interval(hours => $4),
              exige_cuenta = $5, client_id = $6, archivos = $7::jsonb, enviado_a = $8
        WHERE id = $1 AND estado = 'preparando'`,
      [e.id, titulo, mensaje, horas, exigeCuenta, clientId, JSON.stringify(archivos), email || null],
    );
    if (!r.rowCount) return NextResponse.json({ error: 'La entrega ya se publicó' }, { status: 409 });
    if (Number(e.subidas) > 0) {
      limpiarCarpeta(rutaEntrega(e), new Set(archivos.map((x) => x.id))).catch((err) => console.error('[entregas] limpieza', err?.message));
    }
    Object.assign(e, { titulo, mensaje, exige_cuenta: exigeCuenta });
  } else if (!['vigente'].includes(e.estado)) {
    return NextResponse.json({ error: 'La entrega ya no está vigente' }, { status: 409 });
  } else if (email) {
    await pool.query(`UPDATE gcc_world.entregas_unicas SET enviado_a = $2 WHERE id = $1`, [e.id, email]);
  }

  const url = urlEntrega(e.token);
  let enviado = false;
  if (email) {
    try {
      const { rows: [u] } = await pool.query(
        `SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') AS nombre FROM gcc_world.users WHERE id = $1`,
        [String(user.userId)]);
      await sendEntregaUnicaEmail({ email, titulo: e.titulo, url, remitente: u?.nombre || undefined, exigeCuenta: !!e.exige_cuenta });
      enviado = true;
    } catch (err: any) { console.error('[entregas] no salió el correo', err?.message); }
  }
  return NextResponse.json({ data: { id: e.id, url, enviado } });
}
