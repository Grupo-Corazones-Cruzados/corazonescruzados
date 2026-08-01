/**
 * Lectura de la carga que manda Meta: de JSON crudo a mensajes que sabemos tratar.
 *
 * Módulo **puro** a propósito — sin `pg`, sin Next, sin nada del entorno — para poder
 * probarlo en seco. Es el mismo criterio que se aplicó a `lib/flows/variables.ts`: lo que
 * interpreta datos de fuera se prueba aparte de lo que los escribe.
 */

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
