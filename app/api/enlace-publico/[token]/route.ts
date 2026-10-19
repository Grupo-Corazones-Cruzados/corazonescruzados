import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { acceso, limpiarCarpeta, MAX_ARCHIVOS, MAX_TEXTO, porToken, rutaDe, verificarArchivos } from '@/lib/enlaces';

export const runtime = 'nodejs';

/**
 * GET /api/enlace-publico/<token> — qué ve quien abre el enlace. Abrirlo NO lo gasta.
 * Si no puede responder, solo se dice por qué: título e indicaciones pueden ser privados.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const e = await porToken(token);
  const user = await getCurrentUser();
  const a = acceso(e, user ? { userId: String(user.userId) } : null);
  if (!a.ok) return NextResponse.json({ data: { motivo: a.motivo, sesion: user?.email ?? null } });
  return NextResponse.json({
    data: { motivo: null, titulo: e.titulo, indicaciones: e.indicaciones, vence_en: e.vence_en, sesion: user?.email ?? null },
  });
}

/** POST /api/enlace-publico/<token> { texto, archivos: [fileId] } — la respuesta, una sola vez. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const e = await porToken(token);
  const user = await getCurrentUser();
  const a = acceso(e, user ? { userId: String(user.userId) } : null);
  if (!a.ok) return NextResponse.json({ error: 'Este enlace ya no admite respuestas', motivo: a.motivo }, { status: 409 });

  const b = await req.json().catch(() => ({}));
  const texto = String(b.texto || '').trim().slice(0, MAX_TEXTO);
  const ids: string[] = Array.isArray(b.archivos) ? [...new Set(b.archivos.map(String))] as string[] : [];
  if (ids.length > MAX_ARCHIVOS) return NextResponse.json({ error: `Máximo ${MAX_ARCHIVOS} archivos` }, { status: 400 });
  if (!texto && ids.length === 0) return NextResponse.json({ error: 'Escribe algo o adjunta un archivo' }, { status: 400 });

  let archivos;
  try { archivos = await verificarArchivos(rutaDe(e), ids); }
  catch (err: any) { return NextResponse.json({ error: err.message }, { status: 400 }); }

  // `AND estado = 'vigente' AND vence_en > NOW()`: dos envíos a la vez, solo uno entra.
  const r = await pool.query(
    `UPDATE gcc_world.enlaces_unicos
        SET estado = 'usado', respuesta = $2, archivos = $3::jsonb, respondido_en = NOW(), respondido_por = $4
      WHERE id = $1 AND estado = 'vigente' AND vence_en > NOW()`,
    [e.id, texto || null, JSON.stringify(archivos), user ? String(user.userId) : null],
  );
  if (!r.rowCount) return NextResponse.json({ error: 'Este enlace ya no admite respuestas', motivo: 'usado' }, { status: 409 });

  // Lo que se subió y no se envió (quitado antes de enviar) va a la papelera de Drive.
  limpiarCarpeta(rutaDe(e), new Set(archivos.map((x) => x.id))).catch((err) => console.error('[enlaces] limpieza', err?.message));
  return NextResponse.json({ data: { ok: true } });
}
