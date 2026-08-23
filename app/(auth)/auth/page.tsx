/**
 * `/auth` — la puerta genérica, que ya no pregunta nada.
 *
 * Era un formulario para todos —clientes, miembros y candidatos por la misma entrada— y no
 * distinguía nada. Ahora manda a la portada, donde el menú «¿Cómo quieres ingresar?»
 * pregunta con qué tipo de cuenta se entra y abre el diálogo que toca.
 *
 * ── 2026-08-17: AHORA ABRE EL MENÚ, ANTES SOLO DEJABA AL VISITANTE EN LA PORTADA ──
 * Redirigía a `/` a secas, contando con que el visitante pulsara el botón «Plataforma» del
 * héroe. Ese botón **se movió a la barra de navegación** y el héroe se quedó solo con
 * «Comenzar Aventura», así que `/auth` habría dejado a la gente mirando la portada sin
 * saber qué pulsar — y aquí llega el guardián del panel, y correos, y marcadores.
 *
 * Con `?acceso=plataforma` la portada abre el menú al cargar. Es el mismo mecanismo que ya
 * usaban `/auth/cliente`, `/auth/miembro` y `/auth/candidato`, y el mismo diálogo: no hay
 * un segundo formulario de acceso que mantener.
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
import { ACCESO_PLATAFORMA, destinoTrasAccesoValido } from '@/lib/sitio/acceso';

export default async function AccesoGenerico({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const destino = destinoTrasAccesoValido(typeof sp.redirect === 'string' ? sp.redirect : null);

  const q = new URLSearchParams({ acceso: ACCESO_PLATAFORMA });
  // `?redirect=` se conserva **solo si apunta dentro de la plataforma**: es a dónde iba
  // quien fue mandado aquí por el guardián del panel, y la portada ya sabe devolverlo allí
  // tras iniciar sesión. Cualquier otra cosa se descarta (ver `destinoTrasAccesoValido`).
  if (destino) q.set('redirect', destino);
  redirect(`/?${q.toString()}`);
}
