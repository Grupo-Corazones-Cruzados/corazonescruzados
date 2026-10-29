import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { avisosDe, leerPreferencias, guardarPreferencia } from '@/lib/avisos/preferencias';
import type { Canal } from '@/lib/avisos/catalogo';

/**
 * Configuración → Notificaciones (Fernando, 2026-10-29). GET: los avisos que la persona puede
 * recibir y su estado por canal (sin fila = encendido). PUT `{ clase, canal, activo }`.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  try {
    const [avisos, guardadas] = await Promise.all([avisosDe(user), leerPreferencias(user.userId)]);
    const valores: Record<string, boolean> = {};
    for (const a of avisos) for (const c of a.canales) valores[`${a.clase}:${c}`] = guardadas[`${a.clase}:${c}`] ?? true;
    return NextResponse.json({ data: { avisos, valores } });
  } catch (e: any) {
    console.error('Preferencias de avisos GET:', e?.message);
    return NextResponse.json({ error: 'No se pudieron cargar tus notificaciones.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  try {
    const { clase, canal, activo } = await req.json().catch(() => ({}));
    const def = (await avisosDe(user)).find((a) => a.clase === clase);
    if (!def || !def.canales.includes(canal as Canal) || typeof activo !== 'boolean') {
      return NextResponse.json({ error: 'Aviso no válido' }, { status: 400 });
    }
    await guardarPreferencia(user.userId, def.clase, canal as Canal, activo);
    return NextResponse.json({ data: { ok: true } });
  } catch (e: any) {
    console.error('Preferencias de avisos PUT:', e?.message);
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
}
