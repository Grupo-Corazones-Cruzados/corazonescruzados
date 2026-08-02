/**
 * Cierra el alta de un cliente: canjea el código, guarda sus datos y suscribe la cuenta.
 *
 * El navegador solo manda el código y los identificadores que Meta le devolvió. El canje
 * necesita el `app_secret`, que no sale nunca de aquí.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { pool } from '@/lib/db';
import { asegurarCanal, canalPublico, guardarSecreto, anotarError, limpiarError } from '@/lib/agente/canales';
import { claveMaestraConfigurada } from '@/lib/agente/cifrado';
import { canjearCodigo, suscribirWaba, appsSuscritas, numerosDeWaba } from '@/lib/agente/meta';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const { rows: [flujo] } = await pool.query(`SELECT id, type FROM gcc_world.flows WHERE id = $1`, [id]);
  if (flujo?.type !== 'ai_agent') return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });

  if (!claveMaestraConfigurada()) {
    return NextResponse.json(
      { error: 'Falta AGENTE_CLAVE_MAESTRA en el servidor: sin ella no se puede guardar el token del cliente.' },
      { status: 500 },
    );
  }

  const canal = await asegurarCanal(flujo.id);
  const { codigo, waba_id, phone_number_id } = await req.json();

  if (!codigo) return NextResponse.json({ error: 'Falta el código del alta' }, { status: 400 });
  if (!waba_id) return NextResponse.json({ error: 'Meta no devolvió la cuenta de WhatsApp' }, { status: 400 });

  // Un número solo puede estar en un canal. Si ya está en otro, avisar en vez de
  // romper con un error de índice único.
  if (phone_number_id) {
    const { rows: [ocupado] } = await pool.query(
      `SELECT c.id, f.name FROM gcc_world.agente_canales c
         JOIN gcc_world.flows f ON f.id = c.flow_id
        WHERE c.phone_number_id = $1 AND c.id <> $2`,
      [phone_number_id, canal.id],
    );
    if (ocupado) {
      return NextResponse.json(
        { error: `Ese número ya está conectado al agente «${ocupado.name}». Desconéctalo de ahí primero.` },
        { status: 409 },
      );
    }
  }

  await pool.query(
    `UPDATE gcc_world.agente_canales SET estado = 'conectando', updated_at = NOW() WHERE id = $1`, [canal.id],
  );

  try {
    const tokenCliente = await canjearCodigo(String(codigo));
    await guardarSecreto(canal.id, 'wa_token', tokenCliente);

    // Suscribir la app a la cuenta del cliente, y COMPROBARLO. Sin esto no llega ni un
    // mensaje y todo parece correcto.
    await suscribirWaba(String(waba_id), tokenCliente);
    const suscritas = await appsSuscritas(String(waba_id), tokenCliente);
    const suscrita = suscritas.length > 0;

    // Datos del número, para poder enseñarlos y para saber si hace falta más trabajo.
    let numero: any = null;
    try {
      const numeros = await numerosDeWaba(String(waba_id), tokenCliente);
      numero = phone_number_id ? numeros.find((n) => n.id === String(phone_number_id)) ?? numeros[0] : numeros[0];
    } catch { /* el alta sigue siendo válida aunque esta consulta falle */ }

    await pool.query(
      `UPDATE gcc_world.agente_canales
          SET waba_id = $2, phone_number_id = $3, numero_visible = $4, nombre_verificado = $5,
              estado = $6, updated_at = NOW()
        WHERE id = $1`,
      [
        canal.id, String(waba_id), numero?.id ?? phone_number_id ?? null,
        numero?.display_phone_number ?? null, numero?.verified_name ?? null,
        suscrita ? 'conectado' : 'error',
      ],
    );

    if (!suscrita) {
      await anotarError(canal.id, 'El alta terminó pero la app no quedó suscrita a la cuenta: no llegará ningún mensaje.');
    } else {
      await limpiarError(canal.id);
    }

    const { rows: [fresco] } = await pool.query(`SELECT * FROM gcc_world.agente_canales WHERE id = $1`, [canal.id]);
    return NextResponse.json({
      data: canalPublico(fresco),
      suscrita,
      numero,
      // `platform_type: CLOUD_API` NO demuestra coexistencia: describe el lado API. La
      // única comprobación válida es abrir WhatsApp Web, y eso lo hace una persona.
      avisoCoexistencia: 'Comprueba con el cliente que su equipo sigue entrando a WhatsApp Web. Es la única forma de saber que la coexistencia quedó bien.',
    });
  } catch (err: any) {
    await pool.query(`UPDATE gcc_world.agente_canales SET estado = 'error' WHERE id = $1`, [canal.id]);
    await anotarError(canal.id, err?.message ?? 'Fallo al cerrar el alta');
    return NextResponse.json({ error: err?.message ?? 'Fallo al cerrar el alta' }, { status: 502 });
  }
}

/** Vuelve a consultar el estado del número contra Meta. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const { rows: [flujo] } = await pool.query(`SELECT id, type FROM gcc_world.flows WHERE id = $1`, [id]);
  if (flujo?.type !== 'ai_agent') return NextResponse.json({ error: 'Este flujo no es un agente IA' }, { status: 404 });

  const canal = await asegurarCanal(flujo.id);
  if (!canal.waba_id) return NextResponse.json({ error: 'Este agente todavía no tiene número conectado' }, { status: 409 });

  const { secretoDelCanal } = await import('@/lib/agente/canales');
  const token = secretoDelCanal(canal, 'wa_token');
  if (!token) return NextResponse.json({ error: 'No se pudo descifrar el token del cliente' }, { status: 409 });

  try {
    const [numeros, suscritas] = await Promise.all([
      numerosDeWaba(canal.waba_id, token),
      appsSuscritas(canal.waba_id, token),
    ]);
    const numero = numeros.find((n) => n.id === canal.phone_number_id) ?? numeros[0] ?? null;
    return NextResponse.json({ data: { numero, suscrita: suscritas.length > 0, numeros } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'No se pudo consultar a Meta' }, { status: 502 });
  }
}
