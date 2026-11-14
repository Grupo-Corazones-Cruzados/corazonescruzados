import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';

/**
 * Rutas antiguas que solo usa el equipo (auditoría de seguridad, 2026-11-14): sin esto respondían a
 * cualquiera, sin sesión. Devuelve la respuesta de rechazo, o `null` si quien llama es admin o miembro.
 */
export async function soloEquipo(): Promise<NextResponse | null> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  if (user.role !== 'admin' && user.role !== 'member') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  return null;
}
