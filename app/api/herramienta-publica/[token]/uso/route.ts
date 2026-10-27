import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { acceso, porToken } from '@/lib/herramientas/accesos';

/**
 * POST /api/herramienta-publica/<token>/uso — cuenta un uso (se llama al abrir un libro, no al
 * abrir la página: la vista previa de WhatsApp o Gmail también abre el enlace).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await porToken(token);
  const user = await getCurrentUser();
  const r = acceso(a, user ? { userId: String(user.userId) } : null);
  if (!r.ok) return NextResponse.json({ error: 'Este acceso ya no está disponible', motivo: r.motivo }, { status: 409 });
  await pool.query(`UPDATE gcc_world.herramienta_accesos SET usos = usos + 1, ultimo_uso = NOW() WHERE id = $1`, [a.id]);
  return NextResponse.json({ data: { ok: true } });
}
