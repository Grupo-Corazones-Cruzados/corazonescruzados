/**
 * `/auth/{tipo}` — no es una página, es una PUERTA CON NOMBRE.
 *
 * Redirige a la portada pidiéndole que abra el diálogo de acceso que corresponda. El
 * formulario es el de la portada, el mismo que se abre desde «Plataforma»: uno solo, no
 * dos que hay que mantener a la par.
 *
 * Existe para poder dar un enlace directo —«este es el acceso de tus clientes»— sin
 * duplicar la pantalla. Un tipo que no sea de los tres es 404.
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

import { redirect, notFound } from 'next/navigation';
import { esTipoValido } from '@/lib/auth/tipos';

export default async function PuertaDeAcceso({
  params, searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tipo } = await params;
  if (!esTipoValido(tipo)) notFound();

  // `redirect` se conserva: es a dónde iba quien fue enviado aquí por el guardián del panel.
  const sp = await searchParams;
  const destino = typeof sp.redirect === 'string' ? sp.redirect : null;
  const query = new URLSearchParams({ acceso: tipo, ...(destino ? { redirect: destino } : {}) });

  redirect(`/?${query.toString()}`);
}
