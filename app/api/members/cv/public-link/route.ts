/**
 * Enlace público del CV — lado privado (exige sesión).
 *
 *   GET    → ¿tengo enlace? desde cuándo
 *   POST   → generar / regenerar (el anterior deja de servir en el acto)
 *   DELETE → revocar
 *
 * Calcado del enlace público del calendario (`/api/members/calendar/public-link`),
 * que es el mecanismo ya probado. La lógica vive en `lib/members/cv-share.ts`; aquí
 * solo está la sesión.
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { generarEnlace, leerEnlace, memberIdDeUsuario, revocarEnlace } from '@/lib/members/cv-share';

async function miMemberId() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  const memberId = await memberIdDeUsuario(user.userId);
  if (!memberId) return { error: NextResponse.json({ error: 'Not a member' }, { status: 403 }) };
  return { memberId };
}

export async function GET() {
  try {
    const { error, memberId } = await miMemberId();
    if (error) return error;
    const { token, creado } = await leerEnlace(memberId!);
    return NextResponse.json({ token, created_at: creado, member_id: memberId });
  } catch (err: any) {
    console.error('CV public-link GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { error, memberId } = await miMemberId();
    if (error) return error;
    const token = await generarEnlace(memberId!);
    return NextResponse.json({ token, member_id: memberId });
  } catch (err: any) {
    console.error('CV public-link POST error:', err.message);
    return NextResponse.json({ error: 'Error al generar el enlace' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { error, memberId } = await miMemberId();
    if (error) return error;
    await revocarEnlace(memberId!);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('CV public-link DELETE error:', err.message);
    return NextResponse.json({ error: 'Error al revocar el enlace' }, { status: 500 });
  }
}
