/**
 * Envía una plantilla a todos los contactos de una lista.
 *
 * ── POR QUÉ SOLO EL RESPONSABLE Y LOS ADMINISTRADORES ─────────────────────────
 * Esto manda WhatsApp de verdad a gente de verdad, y no se puede deshacer. Un cliente con
 * acceso al flujo puede leer su bandeja y contestar a quien le escribió; lanzar un envío
 * masivo en nombre del negocio es otra cosa, y de momento la decide GCC. Si más adelante
 * el cliente debe poder hacerlo, se cambia aquí y en un solo sitio.
 *
 * ⚠️ NO se responde hasta que termina. Un envío a cien contactos tarda; se hace en serie
 * a propósito (ver `enviarAListado`) para no comerse el límite del número del cliente.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { pool } from '@/lib/db';
import { asegurarCanal } from '@/lib/agente/canales';
import { enviarAListado } from '@/lib/agente/plantillas';

export async function POST(req: Request, { params }: { params: Promise<{ id: string; plantillaId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id, plantillaId } = await params;
  const { rows: [flujo] } = await pool.query(
    `SELECT id, type, responsable_user_id FROM gcc_world.flows WHERE id = $1`, [id],
  );
  if (flujo?.type !== 'ai_agent') return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  if (user.role !== 'admin' && flujo.responsable_user_id !== user.userId) {
    return NextResponse.json(
      { error: 'Solo el responsable del flujo puede lanzar un envío de plantilla.' }, { status: 403 },
    );
  }

  const canal = await asegurarCanal(flujo.id);
  const { rows: [plantilla] } = await pool.query(
    `SELECT * FROM gcc_world.agente_plantillas WHERE id = $1 AND canal_id = $2`,
    [plantillaId, canal.id],
  );
  if (!plantilla) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  // Las listas MARCADAS para esta plantilla. Se vuelven a filtrar por flujo aunque la
  // asociación ya lo comprobó: si algún día se asocian por otro camino, esta consulta
  // sigue impidiendo mandar la plantilla de un cliente a los contactos de otro.
  const { rows: listas } = await pool.query(
    `SELECT l.id, l.name
       FROM gcc_world.agente_plantilla_listas pl
       JOIN gcc_world.flow_contact_lists l ON l.id = pl.lista_id
      WHERE pl.plantilla_id = $1 AND l.flow_id = $2
      ORDER BY l.name`,
    [plantilla.id, flujo.id],
  );
  if (!listas.length) {
    return NextResponse.json(
      { error: 'Esta plantilla no tiene ninguna lista marcada. Marca al menos una con su casilla.' },
      { status: 400 },
    );
  }

  try {
    let enviados = 0, fallidos = 0;
    for (const lista of listas) {
      const r = await enviarAListado(canal, plantilla, lista.id, user.userId);
      enviados += r.enviados; fallidos += r.fallidos;
    }
    return NextResponse.json({
      enviados, fallidos, listas: listas.length,
      mensaje: fallidos
        ? `Enviados ${enviados}, fallaron ${fallidos}. Los fallidos quedan en la bandeja con su error.`
        : `Enviados ${enviados} mensajes. Ya están en la bandeja.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'No se pudo enviar' }, { status: 400 });
  }
}
