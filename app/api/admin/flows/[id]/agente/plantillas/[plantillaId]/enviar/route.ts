/**
 * Envía una plantilla a los contactos de las listas marcadas.
 *
 * ── QUIÉN PUEDE: CUALQUIERA CON ACCESO AL FLUJO ───────────────────────────────
 * Estuvo limitado al responsable y a los administradores, con el razonamiento de que un
 * envío no se puede retirar. Fernando lo cambió (2026-08-03): **el acceso al flujo da
 * todas las funciones del flujo, incluido enviar**. Tiene sentido — el número es del
 * cliente, los contactos son suyos y la plantilla la aprobó Meta para su cuenta; que
 * necesite pedirle a GCC que pulse un botón convierte el producto en un servicio.
 *
 * Lo que protege al envío no es esconder el botón, sino que **la plantilla tenga que estar
 * aprobada**, que solo salga a listas del propio flujo y que la pantalla enseñe los tres
 * primeros mensajes rellenos y pida confirmación antes.
 *
 * ⚠️ NO se responde hasta que termina. Un envío a cien contactos tarda; se hace en serie
 * a propósito (ver `enviarAListado`) para no comerse el límite del número del cliente.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { flujoPermitido } from '@/lib/flows/acceso';
import { pool } from '@/lib/db';
import { asegurarCanal } from '@/lib/agente/canales';
import { enviarAListado } from '@/lib/agente/plantillas';

export async function POST(req: Request, { params }: { params: Promise<{ id: string; plantillaId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id, plantillaId } = await params;
  const flujo = await flujoPermitido(user, id);
  if (flujo?.type !== 'ai_agent') return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

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
