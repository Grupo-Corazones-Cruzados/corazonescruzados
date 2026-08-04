/**
 * `/auth` — la puerta genérica, que ya no pregunta nada.
 *
 * Era un formulario para todos —clientes, miembros y candidatos por la misma entrada— y no
 * distinguía nada. Ahora manda a la portada, donde el botón «Plataforma» pregunta con qué
 * tipo de cuenta se entra y abre el diálogo que toca.
 *
 * ⚠️ La URL NO se retira: está enlazada desde correos, guardada en marcadores y es a donde
 * apunta el guardián del panel cuando alguien intenta entrar sin sesión.
 */


/**
 * ⚠️ DINÁMICA A LA FUERZA, Y NO ES UN DETALLE.
 *
 * En una versión anterior esta ruta era una página con `generateStaticParams`, así que Next
 * la prerenderizó y la sirvió con `s-maxage` de un año. Al convertirla en redirección, el
 * despliegue nuevo salió bien pero la URL seguía devolviendo **el HTML viejo cacheado**
 * (`x-nextjs-cache: HIT`): el arreglo estaba publicado y era invisible.
 *
 * Una ruta cuyo trabajo es redirigir no puede tener respuesta guardada.
 */
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default async function AccesoGenerico({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const destino = typeof sp.redirect === 'string' ? sp.redirect : null;
  redirect(destino ? `/?redirect=${encodeURIComponent(destino)}` : '/');
}
