import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { puedeVer } from '@/lib/enlaces';
import { asegurarTablaEntregas, estadoEntrega, rutaEntrega } from '@/lib/entregas';
import { aPapelera, carpeta } from '@/lib/media/drive';

async function propia(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Inicia sesión' }, { status: 401 }) };
  await asegurarTablaEntregas();
  const { rows: [e] } = await pool.query(
    `SELECT id, creado_por, estado, vence_en, subidas FROM gcc_world.entregas_unicas WHERE id = $1`, [Number(id)]);
  if (!e || !puedeVer({ userId: String(user.userId), role: String(user.role) }, e)) {
    return { error: NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 }) };
  }
  return { e };
}

/** PATCH /api/entregas/<id> { accion: 'cerrar' } — quita el acceso a una entrega vigente. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (b.accion !== 'cerrar') return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  const p = await propia(id);
  if ('error' in p) return p.error;
  if (estadoEntrega(p.e) !== 'vigente') return NextResponse.json({ error: 'La entrega ya no está vigente' }, { status: 409 });
  // `AND estado = 'vigente'`: si la abren a la vez, gana una de las dos.
  const r = await pool.query(
    `UPDATE gcc_world.entregas_unicas SET estado = 'cerrado', cerrado_en = NOW() WHERE id = $1 AND estado = 'vigente'`, [p.e.id]);
  if (!r.rowCount) return NextResponse.json({ error: 'La entrega se acaba de abrir' }, { status: 409 });
  return NextResponse.json({ data: { estado: 'cerrado' } });
}

/**
 * DELETE /api/entregas/<id> — en cualquier estado, también un borrador que se descarta al cerrar
 * el panel. Los archivos van a la PAPELERA de Drive (30 días para recuperarlos), como en enlaces.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await propia(id);
  if ('error' in p) return p.error;
  // Primero la fila: desde aquí el token no abre nada ni se baja nada más.
  await pool.query(`DELETE FROM gcc_world.entregas_unicas WHERE id = $1`, [p.e.id]);
  if (Number(p.e.subidas) > 0) {
    try { await aPapelera(await carpeta(rutaEntrega(p.e))); }
    catch (err: any) { console.error('[entregas] carpeta a la papelera', p.e.id, err?.message); }
  }
  return NextResponse.json({ data: { eliminado: true } });
}
