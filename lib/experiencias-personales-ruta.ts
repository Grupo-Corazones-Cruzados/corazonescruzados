import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolveSubject } from '@/lib/centralized/subject';
import { respuestaDeError } from '@/lib/experiencias-personales';

/**
 * Envoltorio de las rutas de Experiencias personales: exige sesión y que el usuario sea
 * miembro o candidato (los que tienen el módulo Experiencias), y traduce los errores.
 */
export async function conUsuario(contexto: string, fn: (userId: string) => Promise<unknown>): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    if (!(await resolveSubject(user))) return NextResponse.json({ error: 'Esta función es para miembros y candidatos.' }, { status: 403 });
    const data = await fn(user.userId);
    return NextResponse.json({ data: data ?? null });
  } catch (e: any) {
    const r = respuestaDeError(e, contexto);
    return NextResponse.json(r.body, { status: r.status });
  }
}

export function idNumerico(v: string): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : -1;
}
