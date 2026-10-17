import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { asegurarTablaEnlaces, estadoDe, puedeVer, rutaDe } from '@/lib/enlaces';
import { aPapelera, carpeta } from '@/lib/media/drive';

/** PATCH /api/enlaces/<id> { accion: 'cerrar' } — cierra un enlace vigente sin respuesta. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (b.accion !== 'cerrar') return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

  await asegurarTablaEnlaces();
  const { rows: [e] } = await pool.query(`SELECT id, creado_por, estado, vence_en FROM gcc_world.enlaces_unicos WHERE id = $1`, [Number(id)]);
  if (!e || !puedeVer({ userId: String(user.userId), role: String(user.role) }, e)) {
    return NextResponse.json({ error: 'Enlace no encontrado' }, { status: 404 });
  }
  if (estadoDe(e) !== 'vigente') return NextResponse.json({ error: 'El enlace ya no está vigente' }, { status: 409 });
  // `AND estado = 'vigente'`: si la respuesta llega a la vez, gana una de las dos, no las dos.
  const r = await pool.query(
    `UPDATE gcc_world.enlaces_unicos SET estado = 'cerrado', cerrado_en = NOW() WHERE id = $1 AND estado = 'vigente'`,
    [e.id],
  );
  if (!r.rowCount) return NextResponse.json({ error: 'El enlace acaba de recibir respuesta' }, { status: 409 });
  return NextResponse.json({ data: { estado: 'cerrado' } });
}

/**
 * DELETE /api/enlaces/<id> — elimina el enlace, en cualquier estado (Fernando, 2026-10-16).
 * El enlace deja de existir y sus archivos van a la PAPELERA de Drive, no se borran: Drive la
 * vacía a los 30 días y hasta entonces se pueden recuperar si se eliminó por error.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const { id } = await params;
  await asegurarTablaEnlaces();
  const { rows: [e] } = await pool.query(`SELECT id, titulo, creado_por, subidas FROM gcc_world.enlaces_unicos WHERE id = $1`, [Number(id)]);
  if (!e || !puedeVer({ userId: String(user.userId), role: String(user.role) }, e)) {
    return NextResponse.json({ error: 'Enlace no encontrado' }, { status: 404 });
  }
  // Primero la fila: desde aquí el token ya no abre nada y no entra ninguna subida más.
  await pool.query(`DELETE FROM gcc_world.enlaces_unicos WHERE id = $1`, [e.id]);
  // La carpeta solo existe si alguien llegó a subir algo.
  if (Number(e.subidas) > 0) {
    try { await aPapelera(await carpeta(rutaDe(e))); }
    catch (err: any) { console.error('[enlaces] carpeta a la papelera', e.id, err?.message); }
  }
  return NextResponse.json({ data: { eliminado: true } });
}
