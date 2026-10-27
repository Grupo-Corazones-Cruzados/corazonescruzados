import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { puedeVer } from '@/lib/enlaces';
import { asegurarTablaAccesos, estadoDe } from '@/lib/herramientas/accesos';

async function cargar(id: string) {
  await asegurarTablaAccesos();
  const { rows: [a] } = await pool.query(
    `SELECT id, creado_por, estado, vence_en FROM gcc_world.herramienta_accesos WHERE id = $1`, [Number(id)],
  );
  return a ?? null;
}

/** PATCH /api/herramientas/accesos/<id> { accion: 'cerrar' } — el token deja de abrir la herramienta. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (b.accion !== 'cerrar') return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  const a = await cargar(id);
  if (!a || !puedeVer({ userId: String(user.userId), role: String(user.role) }, a)) {
    return NextResponse.json({ error: 'Acceso no encontrado' }, { status: 404 });
  }
  if (estadoDe(a) !== 'vigente') return NextResponse.json({ error: 'El acceso ya no está vigente' }, { status: 409 });
  await pool.query(
    `UPDATE gcc_world.herramienta_accesos SET estado = 'cerrado', cerrado_en = NOW() WHERE id = $1 AND estado = 'vigente'`, [a.id],
  );
  return NextResponse.json({ data: { estado: 'cerrado' } });
}

/** DELETE /api/herramientas/accesos/<id> — lo borra en cualquier estado; no hay archivos que limpiar. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const { id } = await params;
  const a = await cargar(id);
  if (!a || !puedeVer({ userId: String(user.userId), role: String(user.role) }, a)) {
    return NextResponse.json({ error: 'Acceso no encontrado' }, { status: 404 });
  }
  await pool.query(`DELETE FROM gcc_world.herramienta_accesos WHERE id = $1`, [a.id]);
  return NextResponse.json({ data: { eliminado: true } });
}
