import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { evaluarAcceso } from '@/lib/inquilino';
import { canjearPase } from '@/lib/identidadGcc';
import { abrirSesionUsuario, cerrarPasoDos, marcarEmbebido, quitarEmbebido } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

/**
 * Pantallas a las que se puede llegar al entrar (las del menú, `componentes/Navegacion.tsx`); lo
 * demás va al panel. Si el rol o lo montado no alcanzan, la propia página lo devuelve al panel.
 */
const DESTINOS = new Set(['panel', 'conversaciones', 'estudio', 'envios', 'configuracion']);

/**
 * ENTRAR CON LA SESIÓN DE GCC WORLD (Fernando, 2026-11-08: «al ingresar a un producto del que es dueño
 * no tiene sentido pedirle sesión»). La plataforma manda aquí con un pase de un uso
 * (`/api/productos/entrar`); se canjea con ella, de servidor a servidor, y se abre la sesión del
 * usuario ACTIVO con ese correo en este cliente. Sin usuario así, no se entra: el correo de contacto
 * del cliente no basta. Sin segundo paso: la sesión de GCC World ya lo pasó.
 *
 * Vale para las dos clases de cuenta: las del producto con ese correo y las enlazadas a GCC World
 * (`origen = GCC`, sin contraseña aquí), cuyo correo es el de la plataforma. Nunca abre un «ver
 * como»: la sesión lleva los mismos campos que una entrada normal (`terminarDeEntrar`).
 * Mismo modelo que Reservas (`productos/reservas/src/app/[hotel]/entrar/route.ts`).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await ctx.params;
  const q = req.nextUrl.searchParams;
  const aviso = (texto: string, estado: number) =>
    new NextResponse(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:15px system-ui;display:grid;place-items:center;height:90vh;margin:0;background:#0b0b0b;color:#8696a0;color-scheme:dark;text-align:center;padding:24px">${texto}</body>`,
      { status: estado, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );

  const email = await canjearPase(q.get('ticket') || '', cliente);
  if (!email) return aviso('El enlace de entrada caducó. Vuelve a abrir el producto desde GCC World.', 401);

  const inquilino = await prisma.inquilino.findUnique({ where: { slug: cliente }, include: { suscripcion: true } });
  if (!inquilino) return aviso('Este cliente no existe.', 404);
  const cuenta = await prisma.usuario.findFirst({
    where: { inquilinoId: inquilino.id, activo: true, email: { equals: email, mode: 'insensitive' } },
  });
  if (!cuenta) return aviso('Tu cuenta de GCC World no tiene un usuario en este cliente. Pide al administrador que te dé acceso con tu correo.', 403);

  // Lo mismo que `terminarDeEntrar` (acciones/acceso.ts): en un escaparate no se escribe nada.
  if (!inquilino.soloLectura)
    await prisma.usuario.update({ where: { id: cuenta.id }, data: { ultimoAcceso: new Date(), intentosFallidos: 0, bloqueadoHasta: null } });
  await cerrarPasoDos();
  await abrirSesionUsuario({ uid: cuenta.id, inquilinoId: inquilino.id, slug: inquilino.slug, nombre: cuenta.nombre, rol: cuenta.rol });
  // `fuera=1`: se entró desde una pestaña normal (la pantalla de acceso del producto), no dentro de la
  // app de GCC World, así que se ve el producto completo, con su menú propio.
  if (q.get('fuera') === '1') await quitarEmbebido();
  else await marcarEmbebido();

  const pedido = q.get('destino') || '';
  const destino = DESTINOS.has(pedido) ? pedido : 'panel';
  const ruta = evaluarAcceso(inquilino) === 'ok' ? `/${inquilino.slug}/${destino}` : `/${inquilino.slug}/suscripcion`;
  // Relativa: detrás del proxy, el origen que ve el servidor puede ser el interno.
  return new NextResponse(null, { status: 302, headers: { Location: ruta } });
}
