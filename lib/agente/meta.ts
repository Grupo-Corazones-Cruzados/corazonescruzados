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

/**
 * Registra un número en la Cloud API. **Sin esto no se puede enviar nada**: la API
 * responde `(#133010) Account not registered` aunque el número exista, esté en la cuenta
 * y la app esté suscrita.
 *
 * En el alta de un cliente **no hace falta**: el Embedded Signup lo registra por su
 * cuenta. Hace falta para el **número de prueba de Meta**, que nadie ha registrado nunca.
 *
 * El `pin` es la verificación en dos pasos del número. Se manda uno fijo para el número
 * de prueba —no protege nada, es de la app y caduca a los 90 días—; el de un cliente sí
 * es suyo y va cifrado en `pin_cifrado`.
 */
export async function registrarNumero(phoneNumberId: string, token: string, pin: string) {
  return graph(`/${phoneNumberId}/register`, {
    method: 'POST', token,
    body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
  });
}

/* ═══════════════════════ PLANTILLAS DE MENSAJE ═══════════════════════ */

/**
 * Las plantillas de una cuenta, tal como las ve Meta.
 *
 * ⚠️ Meta es la FUENTE DE VERDAD del estado, y cambia solo: una plantilla aprobada puede
 * caerse a `PAUSED` por baja calidad sin que nadie toque nada. Por eso la lista se pide
 * cada vez que se sincroniza y no se confía en lo guardado para decidir si se puede enviar.
 */
export async function plantillasDeWaba(wabaId: string, token: string) {
  const r = await graph(
    `/${wabaId}/message_templates?fields=id,name,language,category,status,rejected_reason,components&limit=200`,
    { method: 'GET', token },
  );
  return (r?.data ?? []) as Array<{
    id: string; name: string; language: string; category: string;
    status: string; rejected_reason?: string; components?: any[];
  }>;
}

/**
 * Crea una plantilla en la cuenta del cliente. Nace en `PENDING`: la aprueba Meta, no
 * nosotros, y puede tardar de minutos a un día.
 *
 * ⚠️ El `example` de cada variable NO es decorativo: sin él Meta rechaza el alta. Es lo
 * que el revisor humano ve para juzgar si el uso es legítimo, así que se manda un valor
 * verosímil y no un «texto».
 */
export async function crearPlantilla(wabaId: string, token: string, cuerpo: Record<string, any>) {
  return graph(`/${wabaId}/message_templates`, {
    method: 'POST', token, body: JSON.stringify(cuerpo),
  });
}

/**
 * Edita una plantilla ya existente. Se dirige al identificador de la PLANTILLA, no al de
 * la cuenta, y vuelve a dejarla en revisión.
 *
 * Meta no deja cambiar el nombre ni el idioma: eso sería otra plantilla. Solo el contenido.
 */
export async function editarPlantilla(metaId: string, token: string, cuerpo: Record<string, any>) {
  return graph(`/${metaId}`, { method: 'POST', token, body: JSON.stringify(cuerpo) });
}

/** Borra una plantilla de la cuenta del cliente, por nombre (así lo pide Meta). */
export async function borrarPlantilla(wabaId: string, token: string, nombre: string) {
  return graph(`/${wabaId}/message_templates?name=${encodeURIComponent(nombre)}`, {
    method: 'DELETE', token,
  });
}

/**
 * Envía un mensaje de plantilla a un número.
 *
 * Es el ÚNICO envío que puede iniciar una conversación: fuera de la ventana de atención
 * de 24 horas, un mensaje libre se rechaza y solo pasa una plantilla aprobada.
 */
export async function enviarPlantilla(
  phoneNumberId: string, token: string,
  { para, nombre, idioma, valores }: { para: string; nombre: string; idioma: string; valores: string[] },
) {
  const componentes = valores.length
    ? [{ type: 'body', parameters: valores.map((v) => ({ type: 'text', text: v })) }]
    : [];
  return graph(`/${phoneNumberId}/messages`, {
    method: 'POST', token,
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'template',
      template: { name: nombre, language: { code: idioma }, ...(componentes.length ? { components: componentes } : {}) },
    }),
  });
}

/** Datos de la cuenta del cliente. */
export async function datosWaba(wabaId: string, token: string) {
  return graph(`/${wabaId}?fields=id,name,currency,timezone_id,account_review_status`, { method: 'GET', token });
}
