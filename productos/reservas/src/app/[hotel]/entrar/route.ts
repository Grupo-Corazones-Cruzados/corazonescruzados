import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { evaluarAcceso } from '@/lib/inquilino';
import { canjearPase } from '@/lib/identidadGcc';
import { abrirSesionUsuario, marcarEmbebido, quitarEmbebido } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

/** Pantallas a las que se puede llegar al entrar (lo demás va al panel). */
const DESTINOS = new Set(['panel', 'reportes', 'usuarios', 'configuracion']);

/**
 * ENTRAR CON LA SESIÓN DE GCC WORLD (Fernando, 2026-11-08: «al ingresar a un producto del que es dueño
 * no tiene sentido pedirle sesión»). La plataforma manda aquí con un pase de un uso
 * (`/api/productos/entrar`); se canjea con ella, de servidor a servidor, y se abre la sesión del
 * usuario ACTIVO con ese correo en este hotel. Sin usuario así, no se entra: el correo de contacto del
 * hotel no basta. Sin segundo paso: la sesión de GCC World ya lo pasó.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ hotel: string }> }) {
  const { hotel } = await ctx.params;
  const q = req.nextUrl.searchParams;
  const aviso = (texto: string, estado: number) =>
    new NextResponse(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:15px system-ui;display:grid;place-items:center;height:90vh;margin:0;color:#555;text-align:center;padding:24px">${texto}</body>`,
      { status: estado, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );

  const email = await canjearPase(q.get('ticket') || '', hotel);
  if (!email) return aviso('El enlace de entrada caducó. Vuelve a abrir el producto desde GCC World.', 401);

  const inquilino = await prisma.inquilino.findUnique({ where: { slug: hotel }, include: { suscripcion: true } });
  if (!inquilino) return aviso('Este hotel no existe.', 404);
  const cuenta = await prisma.usuario.findFirst({
    where: { inquilinoId: inquilino.id, activo: true, email: { equals: email, mode: 'insensitive' } },
  });
  if (!cuenta) return aviso('Tu cuenta de GCC World no tiene un usuario en este hotel. Pide al administrador que te dé acceso con tu correo.', 403);

  if (!inquilino.soloLectura)
    await prisma.usuario.update({ where: { id: cuenta.id }, data: { ultimoAcceso: new Date(), intentosFallidos: 0, bloqueadoHasta: null } });
  await abrirSesionUsuario({ uid: cuenta.id, inquilinoId: inquilino.id, slug: inquilino.slug, nombre: cuenta.nombre, rol: cuenta.rol });
  // `fuera=1`: se llegó desde una pestaña normal (la pantalla de acceso del producto manda a GCC World
  // y vuelve aquí), no desde el marco de la app: el producto se ve completo, con su menú propio.
  if (q.get('fuera') === '1') await quitarEmbebido();
  else await marcarEmbebido();

  const destino = DESTINOS.has(q.get('destino') || '') ? q.get('destino') : 'panel';
  const ruta = evaluarAcceso(inquilino) === 'ok' ? `/${inquilino.slug}/${destino}` : `/${inquilino.slug}/suscripcion`;
  // Relativa: detrás del proxy, el origen que ve el servidor puede ser el interno.
  return new NextResponse(null, { status: 302, headers: { Location: ruta } });
}
