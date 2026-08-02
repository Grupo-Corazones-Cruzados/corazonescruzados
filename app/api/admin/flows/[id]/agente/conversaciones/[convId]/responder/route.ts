/**
 * Responder a mano desde la bandeja.
 *
 * Exige que la conversación esté TOMADA: si el bot sigue encendido, la persona y el
 * agente podrían contestar a la vez y el contacto recibiría dos respuestas distintas.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { secretoDelCanal, anotarError } from '@/lib/agente/canales';
import { enviarTexto } from '@/lib/agente/whatsapp';
import { registrarSaliente } from '@/lib/agente/ingesta';
import { conversacionDelFlujo } from '@/lib/agente/bandeja';

export async function POST(req: Request, { params }: { params: Promise<{ id: string; convId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id, convId } = await params;
  const encontrada = await conversacionDelFlujo(id, convId);
  if (!encontrada) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
  const { conv, canal } = encontrada;

  if (conv.bot_activo) {
    return NextResponse.json(
      { error: 'Toma la conversación antes de escribir, o el agente podría responder a la vez.' },
      { status: 409 },
    );
  }

  const { texto } = await req.json();
  const limpio = String(texto ?? '').trim();
  if (!limpio) return NextResponse.json({ error: 'El mensaje está vacío' }, { status: 400 });
  if (limpio.length > 4000) return NextResponse.json({ error: 'El mensaje pasa de 4.000 caracteres' }, { status: 400 });

  const token = secretoDelCanal(canal, 'wa_token');
  if (!token) {
    const error = 'El canal no tiene token de WhatsApp descifrable. Hay que rehacer la conexión.';
    await anotarError(canal.id, error);
    return NextResponse.json({ error }, { status: 409 });
  }

  const envio = await enviarTexto({
    phoneNumberId: canal.phone_number_id ?? '', token, para: conv.wa_id, texto: limpio,
  });

  // Se guarda pase lo que pase: un intento fallido tiene que verse en el hilo, no
  // desaparecer. `herramienta: null` lo distingue de lo que escribió el agente.
  await registrarSaliente({
    conversacionId: conv.id, texto: limpio, waMessageId: envio.waMessageId,
    herramienta: null, motivo: `Enviado a mano por ${user.email}`,
    enviadoOk: envio.ok, errorEnvio: envio.error,
  });

  if (!envio.ok) {
    await anotarError(canal.id, envio.error ?? 'Fallo al enviar desde la bandeja');
    return NextResponse.json({ error: envio.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, waMessageId: envio.waMessageId });
}
