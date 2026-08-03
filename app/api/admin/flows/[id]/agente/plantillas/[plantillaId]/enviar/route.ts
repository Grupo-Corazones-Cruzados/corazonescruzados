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

  const { lista_id } = await req.json();
  if (!lista_id) return NextResponse.json({ error: 'Elige una lista de contactos.' }, { status: 400 });

  const canal = await asegurarCanal(flujo.id);
  const { rows: [plantilla] } = await pool.query(
    `SELECT * FROM gcc_world.agente_plantillas WHERE id = $1 AND canal_id = $2`,
    [plantillaId, canal.id],
  );
  if (!plantilla) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  // La lista tiene que ser de ESTE flujo. Sin esta comprobación, un identificador escrito
  // a mano mandaría la plantilla de un cliente a los contactos de otro.
  const { rows: [lista] } = await pool.query(
    `SELECT id, name FROM gcc_world.flow_contact_lists WHERE id = $1 AND flow_id = $2`,
    [lista_id, flujo.id],
  );
  if (!lista) return NextResponse.json({ error: 'Esa lista no es de este flujo.' }, { status: 404 });

  try {
    const r = await enviarAListado(canal, plantilla, Number(lista_id), user.userId);
    return NextResponse.json({
      ...r,
      mensaje: r.fallidos
        ? `Enviados ${r.enviados}, fallaron ${r.fallidos}. Los fallidos quedan en la bandeja con su error.`
        : `Enviados ${r.enviados} mensajes. Ya están en la bandeja.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'No se pudo enviar' }, { status: 400 });
  }
}
