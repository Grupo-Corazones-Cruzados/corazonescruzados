import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { accesosDelUsuario, PRODUCTOS } from '@/lib/productos/accesos';
import { emitirPase } from '@/lib/productos/pases';

export const dynamic = 'force-dynamic';

/** Detrás del proxy de Railway, `req.url` lleva el anfitrión interno. */
function origenPublico(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  return process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : req.nextUrl.origin);
}

/**
 * Un aviso legible, no un JSON en crudo: esta ruta se abre DENTRO del marco del producto (Fernando,
 * 2026-11-09, vio `{"error":…}` al entrar a un producto mientras «veía» como otra cuenta).
 */
function aviso(titulo: string, texto: string, estado: number) {
  const e = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  return new NextResponse(
    `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#121212;color:#e8e6ee;font:15px/1.5 system-ui,-apple-system,sans-serif">`
    + `<div style="max-width:420px;padding:24px;text-align:center"><p style="margin:0 0 8px;font-size:17px;font-weight:600">${e(titulo)}</p>`
    + `<p style="margin:0;color:#a9a4b8">${e(texto)}</p></div></body></html>`,
    { status: estado, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

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
  if (!producto || !slug) return aviso('Producto no válido', 'El enlace no lleva a un producto o negocio conocido.', 400);
  const user = await getCurrentUser();
  // Sin sesión (se llegó desde la pantalla de acceso del producto): primero se inicia sesión en GCC
  // World y después se vuelve aquí solo (`destinoTrasAccesoValido` admite esta ruta).
  if (!user) {
    const volver = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    return NextResponse.redirect(new URL(`/?acceso=cliente&redirect=${encodeURIComponent(volver)}`, origenPublico(req)));
  }
  if (user.suplantadoPor) {
    return aviso('No disponible mientras ves como otra cuenta',
      'Los productos no se abren con «Ver». Vuelve a tu vista con el botón de abajo a la izquierda para entrar.', 403);
  }

  const accesos = Object.values(await accesosDelUsuario(user.email)).flat();
  if (!accesos.some((a) => a.producto === producto.clave && a.slug === slug))
    return aviso('Esta cuenta no tiene ese negocio', 'Pide al administrador del negocio que te dé acceso con tu correo.', 403);

  const ticket = await emitirPase(user.email, producto.clave, slug);
  // La dirección del producto es relativa (`/p/<producto>`, bajo GCC World) o, si aún no se migró, su subdominio.
  const url = new URL(`${producto.url}/${encodeURIComponent(slug)}/entrar`, origenPublico(req));
  url.searchParams.set('ticket', ticket);
  url.searchParams.set('destino', destino);
  // Desde una pestaña normal (no dentro de la app), el producto se ve completo, con su menú.
  if (q.get('fuera') === '1') url.searchParams.set('fuera', '1');
  // Bajo GCC World la redirección es RELATIVA: se queda en el dominio desde el que se entró (app, www o el
  // M1). `origenPublico` sale de una variable fijada al compilar y saltaría a producción.
  if (producto.url.startsWith('/'))
    return new NextResponse(null, { status: 302, headers: { Location: `${url.pathname}${url.search}`, 'Cache-Control': 'no-store' } });
  return NextResponse.redirect(url);
}
