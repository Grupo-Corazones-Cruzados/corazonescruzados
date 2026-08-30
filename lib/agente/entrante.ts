/**
 * Lectura de la carga que manda Meta: de JSON crudo a mensajes que sabemos tratar.
 *
 * Módulo **puro** a propósito — sin `pg`, sin Next, sin nada del entorno — para poder
 * probarlo en seco. Es el mismo criterio que se aplicó a `lib/flows/variables.ts`: lo que
 * interpreta datos de fuera se prueba aparte de lo que los escribe.
 */

/** El campo del webhook: dice QUÉ nos está contando Meta, no solo de quién. */
export type CampoWebhook = 'messages' | 'smb_message_echoes' | 'smb_app_state_sync' | 'history' | 'otro';

/** Lo que nos interesa de un mensaje de la Cloud API, ya normalizado. */
export interface MensajeEntrante {
  waMessageId: string;
  waId: string;               // el número del contacto
  nombrePerfil: string | null;
  tipo: string;               // text, image, location, …
  texto: string | null;
  lat: number | null;
  lng: number | null;
  crudo: unknown;
}

/**
 * Saca de la carga de Meta los mensajes que sabemos tratar.
 *
 * Es tolerante a propósito: Meta manda en el mismo webhook cosas que no son mensajes
 * —acuses de entrega, cambios de estado del número— y lo correcto ante lo que no
 * entendemos es ignorarlo, no fallar.
 */
export function extraerMensajes(payload: any): { phoneNumberId: string | null; mensajes: MensajeEntrante[] } {
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const phoneNumberId: string | null = value?.metadata?.phone_number_id ?? null;
  const perfiles: Record<string, string> = {};
  for (const c of value?.contacts ?? []) {
    if (c?.wa_id) perfiles[c.wa_id] = c?.profile?.name ?? '';
  }

  const mensajes: MensajeEntrante[] = [];
  for (const m of value?.messages ?? []) {
    if (!m?.id || !m?.from) continue;
    const tipo = m.type ?? 'unknown';
    mensajes.push({
      waMessageId: m.id,
      waId: m.from,
      nombrePerfil: perfiles[m.from] || null,
      tipo,
      texto:
        tipo === 'text' ? (m.text?.body ?? null)
        : tipo === 'button' ? (m.button?.text ?? null)
        : tipo === 'interactive'
          ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null)
        : tipo === 'location' ? (m.location?.name || m.location?.address || null)
        : null,
      lat: tipo === 'location' ? (m.location?.latitude ?? null) : null,
      lng: tipo === 'location' ? (m.location?.longitude ?? null) : null,
      crudo: m,
    });
  }
  return { phoneNumberId, mensajes };
}


/**
 * De qué va este webhook. Meta manda TODO por la misma URL y solo se distinguen por el
 * `field` de cada cambio, así que leerlo mal significa procesar una cosa como otra.
 */
export function campoDelWebhook(payload: any): CampoWebhook {
  const campo = payload?.entry?.[0]?.changes?.[0]?.field;
  return campo === 'messages' || campo === 'smb_message_echoes'
      || campo === 'smb_app_state_sync' || campo === 'history'
    ? campo : 'otro';
}

/**
 * Lo que se escribe cuando un mensaje NO trae texto y tampoco se va a convertir.
 *
 * ── POR QUÉ HACE FALTA ────────────────────────────────────────────────────────────────
 * Un sticker, un contacto compartido o una reacción llegaban sin texto y se guardaban en
 * blanco. En la bandeja eso es una burbuja vacía: quien atiende no sabe si el cliente
 * mandó algo que no vemos o si la aplicación se comió el mensaje. Y para el agente es
 * peor todavía, porque `historialDe` descarta lo vacío — el mensaje ni existe.
 *
 * No se intenta interpretarlos: un sticker no dice nada que se pueda contestar, y
 * describirlo con el modelo sería pagar por «un dibujo de un gato con corazones». Basta
 * con dejar constancia de que ahí pasó algo, y de qué.
 */
const SIN_TEXTO: Record<string, string> = {
  sticker: '[sticker]',
  contacts: '[contacto compartido]',
  reaction: '[reacción]',
  video: '[video]',
  document: '[documento]',
  location: '[ubicación]',
  unsupported: '[mensaje no admitido]',
  system: '[aviso de WhatsApp]',
  media_placeholder: '[archivo no disponible]',
};

/** Saca el texto de un mensaje de Meta, sea del tipo que sea. Compartido por todos los lectores. */
function textoDe(m: any, tipo: string): string | null {
  const propio =
      tipo === 'text' ? (m?.text?.body ?? null)
    : tipo === 'button' ? (m?.button?.text ?? null)
    : tipo === 'interactive'
      ? (m?.interactive?.button_reply?.title ?? m?.interactive?.list_reply?.title ?? null)
    : tipo === 'location' ? (m?.location?.name || m?.location?.address || null)
    : tipo === 'image' || tipo === 'video' || tipo === 'document'
      ? (m?.[tipo]?.caption ?? null)
    : null;

  if (propio) return propio;

  /**
   * ⚠️ `image` y `audio` NO llevan etiqueta aquí, y es a propósito: se convierten a texto
   * después (`lib/agente/medios.ts`), y esa conversión busca precisamente los mensajes que
   * están **en blanco**. Ponerles «[imagen]» los dejaría fuera y no se describirían nunca.
   */
  return SIN_TEXTO[tipo] ?? null;
}

/** Un mensaje que escribió una PERSONA del equipo del cliente desde su WhatsApp. */
export interface EcoDelEquipo {
  waMessageId: string;
  /** El número del CLIENTE FINAL. En un eco va en `to`, no en `from`: lo manda la empresa. */
  waId: string;
  tipo: string;
  texto: string | null;
  crudo: unknown;
}

/**
 * Lee el webhook `smb_message_echoes`: lo que el equipo del cliente escribe a mano.
 *
 * ⚠️ **`from` es la empresa y `to` es el cliente** — al revés que en un mensaje entrante.
 * Confundirlos crearía un contacto con el número de la propia empresa y colgaría ahí
 * todas las conversaciones del mundo.
 *
 * Se ignoran `edit` y `revoke`: son cambios sobre un mensaje anterior, no mensajes
 * nuevos, y tratarlos como nuevos duplicaría la conversación.
 */
export function extraerEcos(payload: any): { phoneNumberId: string | null; ecos: EcoDelEquipo[] } {
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const phoneNumberId: string | null = value?.metadata?.phone_number_id ?? null;

  const ecos: EcoDelEquipo[] = [];
  for (const m of value?.message_echoes ?? []) {
    if (!m?.id || !m?.to) continue;
    const tipo = m.type ?? 'unknown';
    if (tipo === 'edit' || tipo === 'revoke') continue;

    /**
     * ⚠️ AQUÍ SÍ SE ETIQUETAN LA IMAGEN Y EL AUDIO, al revés que en los entrantes.
     *
     * Los ecos son lo que escribe el equipo del cliente, y **no pasan por la conversión a
     * texto**: `resolverMedios` solo mira los entrantes, porque transcribir lo que la
     * propia empresa envía no le sirve al agente para responder. Si aquí no se etiquetaran,
     * las notas de voz y las fotos del equipo se quedarían en blanco en la bandeja para
     * siempre — y son 130 mensajes solo en Peter Tours.
     */
    /**
     * ⚠️ El AUDIO del equipo se deja en blanco a propósito: se transcribe después, y la
     * conversión busca justo los mensajes vacíos (ver `medios.ts`). La IMAGEN sí lleva
     * etiqueta, porque las suyas no se describen — ya saben lo que acaban de mandar.
     */
    const texto = textoDe(m, tipo) ?? (tipo === 'image' ? '[imagen]' : null);

    ecos.push({ waMessageId: m.id, waId: String(m.to), tipo, texto, crudo: m });
  }
  return { phoneNumberId, ecos };
}

/** Un contacto tal como lo tiene guardado la empresa en su agenda. */
export interface ContactoDeAgenda {
  waId: string;
  nombre: string | null;
  /** `true` si la empresa lo BORRÓ de su agenda: entonces se limpia el nombre, no se inventa. */
  borrado: boolean;
}

/**
 * Lee el webhook `smb_app_state_sync`: la agenda de contactos de la empresa.
 *
 * Es lo que hace que en la bandeja se vea «Sra. Ramírez – Otavalo» en vez de «💕💕💕»:
 * el nombre del perfil lo elige el cliente final, este lo eligió el equipo que atiende.
 *
 * `action` viene como `add` o `remove`. Cualquier otra cosa se trata como alta, que es lo
 * conservador: un nombre de más nunca borra información, uno de menos sí.
 */
export function extraerContactosDeAgenda(payload: any): { phoneNumberId: string | null; contactos: ContactoDeAgenda[] } {
  const value = payload?.entry?.[0]?.changes?.[0]?.value ?? payload?.data;
  const phoneNumberId: string | null = value?.metadata?.phone_number_id ?? null;

  const contactos: ContactoDeAgenda[] = [];
  for (const e of value?.state_sync ?? []) {
    if (e?.type && e.type !== 'contact') continue;
    const tel = e?.contact?.phone_number;
    if (!tel) continue;
    // Meta manda el número con o sin «+» según el sitio; `wa_id` nunca lo lleva.
    const waId = String(tel).replace(/[^0-9]/g, '');
    if (!waId) continue;
    const nombre = e?.contact?.full_name || e?.contact?.first_name || null;
    contactos.push({ waId, nombre: nombre ? String(nombre).trim() : null, borrado: e?.action === 'remove' });
  }
  return { phoneNumberId, contactos };
}

/** Un mensaje del volcado de historial: puede ser de cualquiera de los dos lados. */
export interface MensajeDeHistorial {
  waMessageId: string;
  /** Siempre el número del CLIENTE FINAL, venga el mensaje de él o de la empresa. */
  waId: string;
  deLaEmpresa: boolean;
  tipo: string;
  texto: string | null;
  /** La fecha ORIGINAL del mensaje, no la de ahora. */
  fecha: Date | null;
  crudo: unknown;
}

/**
 * Lee el webhook `history`: hasta 180 días de conversaciones previas al alta.
 *
 * Llega troceado —Meta lo manda en varias tandas— y **desordenado**, así que cada mensaje
 * trae su fecha original y se guarda con ella. Si se guardaran con `NOW()`, toda la
 * historia de Peter Tours aparecería como ocurrida el día del alta.
 *
 * El hilo se identifica por el número del cliente final; dentro, cada mensaje dice de qué
 * lado viene.
 */
export function extraerHistorial(payload: any): { phoneNumberId: string | null; mensajes: MensajeDeHistorial[] } {
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const phoneNumberId: string | null = value?.metadata?.phone_number_id ?? null;
  const propio = String(value?.metadata?.display_phone_number ?? '').replace(/[^0-9]/g, '');

  const mensajes: MensajeDeHistorial[] = [];
  for (const tanda of value?.history ?? []) {
    for (const hilo of tanda?.threads ?? []) {
      const delHilo = String(hilo?.id ?? '').replace(/[^0-9]/g, '');
      for (const m of hilo?.messages ?? []) {
        if (!m?.id) continue;
        const tipo = m.type ?? 'unknown';
        const de = String(m.from ?? '').replace(/[^0-9]/g, '');
        // `from` igual al número de la empresa ⇒ lo escribió el equipo. Si el volcado no
        // trae `from`, se cae a `history_context`, y si tampoco, se asume del cliente.
        const deLaEmpresa = de ? de === propio : m?.history_context?.from_me === true;
        const waId = deLaEmpresa ? delHilo : (de || delHilo);
        if (!waId) continue;
        const seg = Number(m.timestamp);
        mensajes.push({
          waMessageId: m.id, waId, deLaEmpresa, tipo, texto: textoDe(m, tipo),
          fecha: Number.isFinite(seg) && seg > 0 ? new Date(seg * 1000) : null,
          crudo: m,
        });
      }
    }
  }
  return { phoneNumberId, mensajes };
}
