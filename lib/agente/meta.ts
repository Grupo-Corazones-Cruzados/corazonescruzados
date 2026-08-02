/**
 * Llamadas a la Graph API que hacen falta para dar de alta el número de un cliente.
 *
 * Todas usan el token del PROVEEDOR (`WHATSAPP_TOKEN`, el del usuario del sistema de
 * GCC), no el del cliente: son operaciones sobre nuestra app. El token del cliente sale
 * del canje y se guarda cifrado para enviar SUS mensajes.
 */

const VERSION = 'v21.0';
const G = `https://graph.facebook.com/${VERSION}`;

async function graph(ruta: string, opciones: RequestInit & { token: string }) {
  const { token, ...resto } = opciones;
  const res = await fetch(`${G}${ruta}`, {
    ...resto,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(resto.headers ?? {}) },
  });
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = cuerpo?.error ?? {};
    throw new Error(`Meta (${e.code ?? res.status}): ${e.message ?? 'error desconocido'}`);
  }
  return cuerpo;
}

/**
 * Canjea el código del Embedded Signup por el token DEL CLIENTE.
 *
 * Esto se hace en el servidor a propósito: el canje necesita el `app_secret`, y ese no
 * puede salir nunca al navegador. El navegador solo trae el código, que por sí solo no
 * sirve para nada.
 */
export async function canjearCodigo(codigo: string): Promise<string> {
  const appId = process.env.WHATSAPP_APP_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Faltan WHATSAPP_APP_ID o WHATSAPP_APP_SECRET en el servidor');

  const url = new URL(`${G}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('code', codigo);

  const res = await fetch(url);
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok || !cuerpo.access_token) {
    throw new Error(`No se pudo canjear el código: ${cuerpo?.error?.message ?? res.status}`);
  }
  return cuerpo.access_token as string;
}

/**
 * Suscribe NUESTRA app a los webhooks de la cuenta del cliente.
 *
 * Sin esto no llega ni un mensaje de ese cliente, y todo *parece* correcto: el número
 * sale conectado, la app está bien configurada, y el chat simplemente no responde. Es la
 * versión por cliente del despiste que costó dos veces en el proyecto anterior — por eso
 * va aquí, en el alta, y no como un paso manual que alguien pueda olvidar.
 */
export async function suscribirWaba(wabaId: string, tokenCliente: string) {
  return graph(`/${wabaId}/subscribed_apps`, { method: 'POST', token: tokenCliente });
}

/** Comprueba que la suscripción quedó. No basta con que el POST devuelva `success`. */
export async function appsSuscritas(wabaId: string, tokenCliente: string) {
  const r = await graph(`/${wabaId}/subscribed_apps`, { method: 'GET', token: tokenCliente });
  return (r?.data ?? []) as Array<{ whatsapp_business_api_data?: { id?: string; name?: string } }>;
}

/** Los números de una cuenta, con su estado. */
export async function numerosDeWaba(wabaId: string, token: string) {
  const r = await graph(
    `/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,platform_type,status,quality_rating,is_pin_enabled`,
    { method: 'GET', token },
  );
  return (r?.data ?? []) as Array<{
    id: string; display_phone_number?: string; verified_name?: string;
    platform_type?: string; status?: string; quality_rating?: string; is_pin_enabled?: boolean;
  }>;
}

/** Datos de la cuenta del cliente. */
export async function datosWaba(wabaId: string, token: string) {
  return graph(`/${wabaId}?fields=id,name,currency,timezone_id,account_review_status`, { method: 'GET', token });
}
