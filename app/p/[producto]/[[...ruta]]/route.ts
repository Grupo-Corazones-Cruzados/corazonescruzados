import type { NextRequest } from 'next/server';

/**
 * PASARELA A LOS PRODUCTOS (Fernando, 2026-11-08: «eliminar los dominios separados de los productos»).
 *
 * Cada producto se sirve desde GCC World bajo `/p/<producto>/…` (su `basePath`) en vez de su
 * subdominio. Esta ruta reenvía la petición tal cual al servidor del producto y devuelve su respuesta.
 * El destino sale de `PRODUCTO_<PRODUCTO>_ORIGEN` (Railway: su dirección `*.up.railway.app`; M1:
 * `http://127.0.0.1:310x`): un producto sin esa variable aún no está migrado y aquí da 404.
 *
 * ⚠️ No es una «rewrite» de next.config: esas se fijan al compilar, y el M1 se compila en otra Mac con
 * otros destinos. Además así no pesan el límite de 30 s del proxy de Next (la IA de Planificaciones)
 * ni el de 10 MB del middleware (que no mira `/p/`).
 *
 * Aislamiento: al producto solo le llegan SUS cookies (`<producto>_…`); la sesión de GCC World
 * (`auth_token`) y las de los otros productos se quedan aquí.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const PRODUCTOS = new Set(['reservas', 'pedidos', 'catering', 'planificaciones', 'automatizaciones']);

// Cabeceras de un salto, o que fetch calcula solo. `accept-encoding`: sin compresión entre los dos
// servidores, así el cuerpo pasa tal cual y no hay que deshacer gzip.
const NO_REENVIAR = new Set([
  'host', 'connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer',
  'content-length', 'accept-encoding', 'cookie', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port',
]);
const NO_DEVOLVER = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length', 'set-cookie']);

function origenDe(producto: string) {
  return process.env[`PRODUCTO_${producto.toUpperCase()}_ORIGEN`]?.replace(/\/+$/, '') || null;
}

async function pasarela(req: NextRequest, ctx: { params: Promise<{ producto: string }> }) {
  const { producto } = await ctx.params;
  const origen = PRODUCTOS.has(producto) ? origenDe(producto) : null;
  if (!origen) return new Response('No encontrado', { status: 404 });

  const cabeceras = new Headers();
  req.headers.forEach((valor, nombre) => { if (!NO_REENVIAR.has(nombre)) cabeceras.set(nombre, valor); });
  const propias = (req.headers.get('cookie') || '')
    .split(';').map((c) => c.trim()).filter((c) => c.startsWith(`${producto}_`));
  if (propias.length) cabeceras.set('cookie', propias.join('; '));
  // El anfitrión público, para que el producto compare bien el Origin de sus Server Actions.
  cabeceras.set('x-forwarded-host', req.headers.get('x-forwarded-host') || req.headers.get('host') || '');
  cabeceras.set('x-forwarded-proto', req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', ''));
  cabeceras.set('accept-encoding', 'identity');

  const conCuerpo = req.method !== 'GET' && req.method !== 'HEAD';
  let r: Response;
  try {
    r = await fetch(`${origen}${req.nextUrl.pathname}${req.nextUrl.search}`, {
      method: req.method,
      headers: cabeceras,
      body: conCuerpo ? req.body : undefined,
      redirect: 'manual',
      cache: 'no-store',
      // @ts-expect-error: necesario en Node para enviar un cuerpo en streaming
      duplex: conCuerpo ? 'half' : undefined,
    });
  } catch (e) {
    console.error(`[pasarela ${producto}]`, e instanceof Error ? e.message : e);
    return new Response('El producto no responde. Inténtalo de nuevo en un momento.', { status: 502 });
  }

  const salida = new Headers();
  r.headers.forEach((valor, nombre) => { if (!NO_DEVOLVER.has(nombre)) salida.set(nombre, valor); });
  for (const c of r.headers.getSetCookie()) salida.append('set-cookie', c);
  // Una redirección absoluta al servidor interno se deja relativa: el navegador sigue en GCC World.
  const destino = salida.get('location');
  if (destino?.startsWith(origen)) salida.set('location', destino.slice(origen.length) || '/');

  return new Response(req.method === 'HEAD' ? null : r.body, { status: r.status, statusText: r.statusText, headers: salida });
}

export { pasarela as GET, pasarela as POST, pasarela as PUT, pasarela as PATCH, pasarela as DELETE, pasarela as HEAD, pasarela as OPTIONS };
