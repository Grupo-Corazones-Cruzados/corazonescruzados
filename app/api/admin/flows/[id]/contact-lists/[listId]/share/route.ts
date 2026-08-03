import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { createShareToken, revokeShareToken, shareUrl, ShareError } from '@/lib/flows/contact-share';
import { puedeVerFlujo } from '@/lib/flows/acceso';

/**
 * Enlace público de una lista de contactos (Automatizaciones → Email masivo).
 *
 * GET    → estado actual del enlace (si existe, su URL)
 * POST   → genera el enlace; si ya había uno, lo REGENERA (el anterior deja de servir)
 * DELETE → revoca el enlace (la lista y sus contactos no se tocan)
 */

/**
 * ⚠️ Antes esto exigía rol de administrador y por eso un cliente con acceso al flujo no
 * podía ver sus listas de contactos. La regla correcta es la del flujo — ver
 * `puedeVerFlujo` en `lib/flows/acceso.ts`.
 */
async function puedeEntrar(flowId: string) {
  return puedeVerFlujo(await getCurrentUser(), flowId);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; listId: string }> }) {
  try {
    const { id, listId } = await params;
    if (!await puedeEntrar(id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { rows: [row] } = await pool.query(
      `SELECT share_token, share_created_at FROM gcc_world.flow_contact_lists WHERE id = $1 AND flow_id = $2`,
      [listId, id],
    );
    if (!row) return NextResponse.json({ error: 'La lista no existe' }, { status: 404 });

    return NextResponse.json({
      data: row.share_token
        ? { url: shareUrl(row.share_token, req.nextUrl.origin), createdAt: row.share_created_at }
        : null,
    });
  } catch (err: any) {
    console.error('Contact list share GET error:', err.message);
    return NextResponse.json({ error: 'Error al leer el enlace' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; listId: string }> }) {
  try {
    const { id, listId } = await params;
    if (!await puedeEntrar(id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = await createShareToken(id, listId);
    // Se devuelve también el token: el panel arma la URL con el origen del navegador, que es
    // el correcto de cara al usuario (el del request puede ser el interno del contenedor).
    return NextResponse.json({ data: { token, url: shareUrl(token, req.nextUrl.origin) } }, { status: 201 });
  } catch (err: any) {
    if (err instanceof ShareError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Contact list share POST error:', err.message);
    return NextResponse.json({ error: 'Error al generar el enlace' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; listId: string }> }) {
  try {
    const { id, listId } = await params;
    if (!await puedeEntrar(id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await revokeShareToken(id, listId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Contact list share DELETE error:', err.message);
    return NextResponse.json({ error: 'Error al revocar el enlace' }, { status: 500 });
  }
}
