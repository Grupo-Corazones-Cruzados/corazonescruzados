import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { accesosDelUsuario, PRODUCTOS } from '@/lib/productos/accesos';
import { emitirPase } from '@/lib/productos/pases';

export const dynamic = 'force-dynamic';

/**
 * ENTRAR A UN NEGOCIO DE UN PRODUCTO CON LA SESIÓN DE GCC WORLD (`lib/productos/pases.ts`).
 * GET /api/productos/entrar?producto=reservas&slug=mi-hotel&destino=panel → 302 al producto con un
 * pase de un uso. Solo si la cuenta tiene ese negocio, y nunca desde «ver como otro usuario».
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const producto = PRODUCTOS.find((p) => p.clave === q.get('producto'));
  const slug = q.get('slug') || '';
  const destino = (q.get('destino') || 'panel').replace(/[^a-z0-9-]/g, '');
  const user = await getCurrentUser();
  if (!user || !producto || !slug) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.suplantadoPor) return NextResponse.json({ error: 'No disponible mientras ves la plataforma como otro usuario' }, { status: 403 });

  const accesos = Object.values(await accesosDelUsuario(user.email)).flat();
  if (!accesos.some((a) => a.producto === producto.clave && a.slug === slug))
    return NextResponse.json({ error: 'Esta cuenta no tiene ese negocio' }, { status: 403 });

  const ticket = await emitirPase(user.email, producto.clave, slug);
  const url = new URL(`${producto.url}/${encodeURIComponent(slug)}/entrar`);
  url.searchParams.set('ticket', ticket);
  url.searchParams.set('destino', destino);
  return NextResponse.redirect(url);
}
