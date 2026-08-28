/**
 * Webhook de la Cloud API de Meta.
 *
 * ⇒ ESTE ENDPOINT NO PIENSA. Valida la firma, persiste el mensaje, encola un trabajo y
 * devuelve 200. Todo el trabajo de verdad es del worker.
 *
 * El motivo no es elegancia: si aquí se devuelve un 500, Meta reintenta y, si insiste,
 * **deshabilita el webhook**. A partir de ese momento se pierden mensajes de clientes
 * reales sin que nadie se entere. Por eso el `catch` de abajo también responde 200.
 *
 * La única respuesta que no es 200 es el **403 por firma inválida**, y ahí es justo lo
 * que queremos: eso no viene de Meta.
 */

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { firmaValida } from '@/lib/agente/firma';
import { canalPorNumero } from '@/lib/agente/canales';
import {
  extraerMensajes, ingerir, campoDelWebhook,
  extraerEcos, ingerirEco,
  extraerContactosDeAgenda, guardarContactosDeAgenda,
  extraerHistorial, ingerirHistorial,
} from '@/lib/agente/ingesta';
import { encolar } from '@/lib/agente/cola';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Alta del webhook: Meta llama una vez con `hub.verify_token` y espera de vuelta
 * `hub.challenge` en texto plano. Si el token no coincide, no valida la URL.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const modo = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const reto = url.searchParams.get('hub.challenge');

  const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
  if (modo === 'subscribe' && esperado && token === esperado && reto) {
    return new NextResponse(reto, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
  // El cuerpo CRUDO, sin parsear: la firma se calcula sobre estos bytes exactos.
  const crudo = await req.text();

  if (!firmaValida(crudo, req.headers.get('x-hub-signature-256'), process.env.WHATSAPP_APP_SECRET)) {
    // Se deja rastro del intento, sin canal porque no nos fiamos de su contenido.
    try {
      await pool.query(
        `INSERT INTO gcc_world.agente_eventos_webhook (firma_valida, payload) VALUES (false, $1)`,
        [JSON.stringify({ nota: 'firma inválida', longitud: crudo.length })],
      );
    } catch { /* la traza no puede tumbar la respuesta */ }
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const payload = JSON.parse(crudo);

    /**
     * ⇒ QUÉ NOS ESTÁ CONTANDO META. Todo llega por esta misma URL y solo el `field` los
     * distingue. Antes solo se leía `messages`, y por eso en un número de coexistencia el
     * agente no veía a las personas del equipo del cliente ni sabía cómo las llamaba él.
     */
    const campo = campoDelWebhook(payload);

    const { phoneNumberId, mensajes } = campo === 'messages'
      ? extraerMensajes(payload)
      : { phoneNumberId: payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null, mensajes: [] };

    const canal = phoneNumberId ? await canalPorNumero(phoneNumberId) : null;

    // Traza cruda. Va siempre, incluso si el número no es de ningún canal nuestro:
    // es lo que permite diagnosticar un alta a medias sin adivinar.
    await pool.query(
      `INSERT INTO gcc_world.agente_eventos_webhook (canal_id, firma_valida, payload) VALUES ($1, true, $2)`,
      [canal?.id ?? null, crudo.slice(0, 100_000)],
    );

    // Sin canal no hay nada que hacer con ninguna carga: el número no es nuestro.
    if (!canal) return NextResponse.json({ ok: true });

    /**
     * ── LO QUE ESCRIBE EL EQUIPO DEL CLIENTE (`smb_message_echoes`) ─────────────────
     * Se guarda como saliente y **la conversación pasa a esa persona**: ver `ingerirEco`.
     * No se encola nada — el agente no contesta a su propio compañero.
     */
    if (campo === 'smb_message_echoes') {
      const { ecos } = extraerEcos(payload);
      for (const e of ecos) await ingerirEco(canal.id, e);
      return NextResponse.json({ ok: true });
    }

    /**
     * ── LA AGENDA DEL CLIENTE (`smb_app_state_sync`) ────────────────────────────────
     * Los nombres con los que la empresa tiene guardados a sus clientes. Llega de golpe
     * al sincronizar, y luego cada vez que la empresa añade o quita un contacto.
     */
    if (campo === 'smb_app_state_sync') {
      const { contactos } = extraerContactosDeAgenda(payload);
      if (contactos.length) await guardarContactosDeAgenda(canal.id, contactos);
      return NextResponse.json({ ok: true });
    }

    /**
     * ── LAS CONVERSACIONES DE ANTES DEL ALTA (`history`) ────────────────────────────
     * Llega troceado y desordenado, cada mensaje con su fecha original. No despierta al
     * agente: son mensajes de hace semanas.
     */
    if (campo === 'history') {
      const { mensajes: viejos } = extraerHistorial(payload);
      for (const m of viejos) await ingerirHistorial(canal.id, m);
      return NextResponse.json({ ok: true });
    }

    // Acuses de entrega, cambios de estado del número… nada que hacer. Se responde 200
    // igual: para Meta está entregado.
    if (mensajes.length === 0) {
      return NextResponse.json({ ok: true });
    }

    for (const m of mensajes) {
      const r = await ingerir(canal.id, m);

      // Ya lo teníamos ⇒ Meta está reintentando. Ni se encola ni se responde dos veces.
      if (!r.esNuevo) continue;

      // El canal apagado, o una persona con la conversación tomada: se guarda el mensaje
      // —para que se vea en la bandeja— pero no se despierta al agente.
      if (!canal.bot_activo || r.conversacionEnManosDeUnaPersona) continue;

      await encolar(r.conversacionId, canal.debounce_segundos);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // 200 A PROPÓSITO. Un 500 aquí hace que Meta reintente y acabe deshabilitando el
    // webhook, y entonces se pierden mensajes de clientes reales. El fallo se investiga
    // por los logs y por agente_eventos_webhook, no devolviéndole un error a Meta.
    console.error('[agente/webhook]', err?.message);
    return NextResponse.json({ ok: true });
  }
}
