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
