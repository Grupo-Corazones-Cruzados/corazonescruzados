/**
 * Trae del WhatsApp del cliente lo que ya tenía antes de conectarse: su agenda de
 * contactos y sus conversaciones anteriores.
 *
 * ⛔ ESTA RUTA GASTA ALGO QUE NO VUELVE. Meta permite pedir cada sincronización **una sola
 * vez** y **dentro de las 24 horas siguientes al alta**. Si se gasta el intento o se pasa
 * el plazo, la única forma de recuperarlo es desconectar al cliente y repetir el Embedded
 * Signup entero, con él delante. Por eso:
 *   · se comprueba antes si ya se pidió, y se niega en vez de repetir;
 *   · se anota la fecha ANTES de llamar a Meta, no después.
 *
 * Lo de anotar antes es a propósito y no es paranoia: si Meta acepta la petición y la
 * respuesta se pierde por el camino —un timeout, un despliegue a medias—, el intento ya
 * está consumido en su lado. Anotarlo después dejaría la fila diciendo que no se pidió, y
 * el siguiente clic lo volvería a intentar contra una puerta ya cerrada.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { flujoPermitido } from '@/lib/flows/acceso';
import { pool } from '@/lib/db';
import { canalPorFlujo, secretoDelCanal } from '@/lib/agente/canales';
import { pedirSincronizacion } from '@/lib/agente/meta';

/** Qué se puede pedir, y en qué columna se anota que ya se pidió. */
const TIPOS = {
  contactos: { sync: 'smb_app_state_sync' as const, columna: 'contactos_sincronizados_en', nombre: 'la agenda de contactos' },
  historial: { sync: 'history' as const, columna: 'historial_sincronizado_en', nombre: 'el historial de conversaciones' },
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const flujo = await flujoPermitido(user, id);
  if (!flujo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (flujo.type !== 'ai_agent') return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });

  const { tipo } = await req.json();
  const cual = TIPOS[tipo as keyof typeof TIPOS];
  if (!cual) return NextResponse.json({ error: 'Solo se puede sincronizar «contactos» o «historial»' }, { status: 400 });

  const canal = await canalPorFlujo(flujo.id);
  if (!canal?.phone_number_id) {
    return NextResponse.json({ error: 'Este agente todavía no tiene número conectado' }, { status: 409 });
  }

  const token = secretoDelCanal(canal, 'wa_token');
  if (!token) return NextResponse.json({ error: 'No se pudo descifrar el token del cliente' }, { status: 409 });

  // Ya se pidió: no se repite. El intento está gastado y volver a llamar solo trae un
  // error de Meta que se leería como un fallo nuestro.
  const yaEn = (canal as any)[cual.columna];
  if (yaEn) {
    return NextResponse.json(
      { error: `Ya se pidió ${cual.nombre} el ${new Date(yaEn).toLocaleString('es-EC')}. Meta solo lo permite una vez por alta.` },
      { status: 409 },
    );
  }

  // Se marca ANTES de llamar. Ver la cabecera: el intento se consume en Meta aunque
  // nosotros nos quedemos sin respuesta.
  await pool.query(
    `UPDATE gcc_world.agente_canales SET ${cual.columna} = NOW(), updated_at = NOW() WHERE id = $1`,
    [canal.id],
  );

  try {
    await pedirSincronizacion(canal.phone_number_id, token, cual.sync);
  } catch (err: any) {
    return NextResponse.json(
      {
        error: `Meta rechazó la petición: ${err?.message ?? err}. El intento queda marcado como usado a propósito: ` +
               'si Meta lo aceptó y falló la respuesta, repetirlo no funcionaría.',
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    aviso: `Pedido a Meta ${cual.nombre}. NO llega en esta respuesta: Meta lo manda por webhook en las ` +
           'próximas horas, en varias tandas. Ve mirando la bandeja.',
  });
}
