import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/jwt';
import { COOKIE_REGISTRO_LIBRE, firmaRegistroLibre } from '@/lib/registro/limite';

/**
 * MARCAR ESTE NAVEGADOR COMO «SIN LÍMITE DE REGISTROS» (Fernando, 2026-10-29: «únicamente mi IP o
 * mis dispositivos personales tendrán acceso a crear cuentas sin limitación»).
 *
 * Solo un ADMIN con sesión: abre `/api/admin/registro-libre` en cada dispositivo suyo y queda
 * marcado un año (cookie firmada por el servidor). `?quitar=1` lo desmarca. Las IPs fijas, en la
 * variable `REGISTRO_SIN_LIMITE_IPS`. Ver `lib/registro/limite.ts`.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const quitar = new URL(req.url).searchParams.get('quitar') === '1';
  const almacen = await cookies();
  if (quitar) almacen.delete(COOKIE_REGISTRO_LIBRE);
  else {
    almacen.set(COOKIE_REGISTRO_LIBRE, firmaRegistroLibre(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return NextResponse.json({
    ok: true,
    mensaje: quitar
      ? 'Este navegador vuelve a tener el límite de un registro cada 24 horas.'
      : 'Este navegador queda SIN límite de registros durante un año.',
  });
}
