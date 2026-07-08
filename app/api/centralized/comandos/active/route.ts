import { getCurrentUser } from '@/lib/auth/jwt';
import { getActiveEffects } from '@/lib/centralized/comandos-db';
import { NextResponse } from 'next/server';

// GET — efectos activos de las políticas: { messages, blockedModules }. Lo consume el
// dashboard (banner de mensaje permanente + bloqueo de módulos). Cualquier usuario
// autenticado (todos los roles del dashboard los necesitan).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    return NextResponse.json({ data: await getActiveEffects() });
  } catch (err: any) {
    console.error('Comandos active GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
