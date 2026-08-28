/**
 * Envío por la Cloud API de Meta. Se llama con `fetch`: no hace falta ninguna dependencia.
 *
 * ⇒ El token es **el del canal**, no el del entorno. Es el segundo acoplamiento a un solo
 * cliente que señalaba la guía: allí `tokenWhatsapp()` leía del entorno y por tanto solo
 * podía servir a un número. Aquí cada canal trae el suyo, descifrado en el momento.
 */

const VERSION = 'v21.0';

export interface ResultadoEnvio {
  ok: boolean;
  waMessageId?: string;
  error?: string;
}

/** Manda un mensaje de texto. Solo texto y enlaces — decisión cerrada del producto. */
export async function enviarTexto(opciones: {
  phoneNumberId: string;
  token: string;
  para: string;
  texto: string;
}): Promise<ResultadoEnvio> {
  if (!opciones.token) return { ok: false, error: 'El canal no tiene token de WhatsApp' };
  if (!opciones.phoneNumberId) return { ok: false, error: 'El canal no tiene número conectado' };

  try {
    const res = await fetch(`https://graph.facebook.com/${VERSION}/${opciones.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opciones.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: opciones.para,
        type: 'text',
        // `preview_url` apagado: los enlaces se envían tal cual, sin tarjeta de vista previa.
        text: { preview_url: false, body: opciones.texto },
      }),
    });

    const cuerpo = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: explicarError(res.status, cuerpo) };
    }
    return { ok: true, waMessageId: cuerpo?.messages?.[0]?.id };
  } catch (err: any) {
    return { ok: false, error: `No se pudo contactar con Meta: ${err?.message ?? err}` };
  }
}

/**
 * Traduce los errores de Meta a algo que sirva en el panel.
 *
 * El 131047 es el que confunde a todo el mundo: **no es un fallo**. Significa que
 * pasaron más de 24 horas desde el último mensaje del contacto, y fuera de esa ventana
 * solo se puede escribir con una plantilla aprobada. El agente responde dentro de la
 * ventana por definición, así que si aparece es que algo tardó demasiado.
 */
function explicarError(estado: number, cuerpo: any): string {
  const e = cuerpo?.error ?? {};
  const codigo = e.code ?? e.error_subcode;
  const detalle = e.message ?? `HTTP ${estado}`;

  if (codigo === 131047) {
    return 'Pasaron más de 24 horas desde el último mensaje del contacto: fuera de esa ventana solo se puede escribir con una plantilla aprobada.';
  }
  if (codigo === 131030) {
    return 'El número del contacto no está en la lista de destinatarios de prueba. Con el número real conectado esto desaparece.';
  }
  if (codigo === 190 || estado === 401) {
    return 'El token de WhatsApp de este cliente caducó o fue revocado. Hay que rehacer la conexión.';
  }
  if (codigo === 100) {
    return `Meta rechazó la petición: ${detalle}`;
  }
  return `Error de Meta (${codigo ?? estado}): ${detalle}`;
}

/** Consulta el estado del número. `CONNECTED` + `CLOUD_API` es lo que se busca tras el alta. */
export async function estadoDelNumero(phoneNumberId: string, token: string) {
  const res = await fetch(
    `https://graph.facebook.com/${VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name,platform_type,status,quality_rating,is_pin_enabled`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(explicarError(res.status, cuerpo));
  return cuerpo as {
    display_phone_number?: string;
    verified_name?: string;
    platform_type?: string;
    status?: string;
    quality_rating?: string;
    is_pin_enabled?: boolean;
  };
}

/* ═══════════════════ MEDIOS QUE MANDA EL CLIENTE FINAL ═══════════════════ */

/**
 * Baja una nota de voz o una imagen de WhatsApp.
 *
 * ⚠️ SON DOS PETICIONES, Y LA SEGUNDA TAMBIÉN VA FIRMADA. Meta no entrega el archivo en el
 * webhook: manda un identificador. Con él se pide la ficha del medio, que devuelve una URL
 * temporal… **que tampoco es pública**. Hay que volver a mandar el `Authorization` al
 * descargarla o responde 401. Es el despiste clásico con esta API: la URL parece un enlace
 * normal y no lo es.
 *
 * Se acota el tamaño porque el archivo entra entero en memoria del worker y luego viaja a
 * OpenAI; el límite de la transcripción son 25 MB, así que por encima de eso no hay nada
 * que ganar bajándolo.
 */
const TOPE_MEDIO = 20 * 1024 * 1024;

export async function descargarMedio(
  mediaId: string,
  token: string,
): Promise<{ bytes: Buffer; mime: string } | null> {
  const cabecera = { Authorization: `Bearer ${token}` };

  const ficha = await fetch(`https://graph.facebook.com/${VERSION}/${mediaId}`, { headers: cabecera });
  if (!ficha.ok) return null;
  const datos = await ficha.json().catch(() => null);
  if (!datos?.url) return null;
  if (datos.file_size && Number(datos.file_size) > TOPE_MEDIO) return null;

  const archivo = await fetch(datos.url, { headers: cabecera });
  if (!archivo.ok) return null;

  const bytes = Buffer.from(await archivo.arrayBuffer());
  if (bytes.byteLength > TOPE_MEDIO) return null;

  // El `mime_type` de Meta puede traer parámetros («audio/ogg; codecs=opus») y hay sitios
  // donde solo vale el tipo. Se guarda limpio.
  const mime = String(datos.mime_type ?? '').split(';')[0].trim() || 'application/octet-stream';
  return { bytes, mime };
}
