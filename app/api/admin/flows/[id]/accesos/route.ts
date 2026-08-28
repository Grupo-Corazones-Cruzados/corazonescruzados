/**
 * QUIÉN ENTRA A ESTE FLUJO: los clientes con acceso, y el alta y baja de cada uno.
 *
 * ── QUIÉN PUEDE TOCAR ESTO ─────────────────────────────────────────────────────
 * Solo el **responsable** del flujo y los **administradores**. Un cliente con acceso no
 * puede dárselo a otro: si pudiera, el control de quién ve las conversaciones dejaría de
 * estar en manos de GCC, que es justo lo que el encargo del tratamiento nos obliga a
 * sostener.
 *
 * El GET devuelve además el **catálogo de clientes** para poder elegir. Va en la misma
 * respuesta a propósito: son dos listas que siempre se piden juntas, y separarlas obligaría
 * al panel a encadenar dos peticiones antes de poder pintar nada.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { flujoAdministrable } from '@/lib/flows/acceso';
import { pool } from '@/lib/db';

/**
 * El flujo, si este usuario puede ADMINISTRAR sus accesos. Distinto de poder verlo.
 *
 * La regla —responsable o administrador— vive en `flujoAdministrable()` de
 * `lib/flows/acceso.ts`. Aquí estaba copiada, y esa copia era la única que existía: `PUT` y
 * `DELETE` del flujo se habían quedado sin ninguna comprobación. Ahora la respuesta es una
 * sola y esto solo la envuelve en la respuesta HTTP que toca.
 */
async function flujoAdministrablePorHttp(flowId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };

  const flujo = await flujoAdministrable(user, flowId);
  if (flujo) return { flujo, user };

  // Se distingue «no existe» de «no es tuyo»: al responsable le sirve saber cuál es.
  const { rows: [existe] } = await pool.query(`SELECT 1 FROM gcc_world.flows WHERE id = $1`, [flowId]);
  return {
    error: existe
      ? NextResponse.json({ error: 'Solo el responsable del flujo puede cambiar quién accede.' }, { status: 403 })
      : NextResponse.json({ error: 'No encontrado' }, { status: 404 }),
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error, flujo } = await flujoAdministrablePorHttp(id);
  if (error) return error;

  const { rows: conAcceso } = await pool.query(
    `SELECT c.id, c.name, c.email, c.company, c.account_type, fc.created_at
       FROM gcc_world.flow_clients fc
       JOIN gcc_world.clients c ON c.id = fc.client_id
      WHERE fc.flow_id = $1
      ORDER BY c.name`,
    [flujo.id],
  );

  // El catálogo, sin los que ya están: enseñar en el buscador a alguien que ya tiene acceso
  // solo lleva a pulsarlo y ver que no pasa nada.
  const { rows: disponibles } = await pool.query(
    `SELECT id, name, email, company, account_type
       FROM gcc_world.clients
      WHERE id NOT IN (SELECT client_id FROM gcc_world.flow_clients WHERE flow_id = $1)
      ORDER BY name
      LIMIT 500`,
    [flujo.id],
  );

  const { rows: [resp] } = await pool.query(
    `SELECT first_name, last_name, email FROM gcc_world.users WHERE id = $1`,
    [flujo.responsable_user_id],
  );

  return NextResponse.json({
    data: {
      flujo: { id: flujo.id, name: flujo.name },
      responsable: resp
        ? { nombre: [resp.first_name, resp.last_name].filter(Boolean).join(' '), email: resp.email }
        : null,
      conAcceso,
      disponibles,
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error, flujo } = await flujoAdministrablePorHttp(id);
  if (error) return error;

  const { client_id } = await req.json();
  if (!client_id) return NextResponse.json({ error: 'Falta el cliente' }, { status: 400 });

  const { rows: [cliente] } = await pool.query(
    `SELECT id, name, user_id FROM gcc_world.clients WHERE id = $1`, [client_id],
  );
  if (!cliente) return NextResponse.json({ error: 'Ese cliente no existe' }, { status: 404 });

  // ⚠️ Un cliente SIN cuenta de acceso no podrá entrar aunque figure aquí: el permiso se
  // resuelve por `clients.user_id`. Vale la pena decirlo en el momento y no dejar que
  // alguien descubra dentro de un mes que el acceso que dio no servía de nada.
  const aviso = cliente.user_id
    ? null
    : `«${cliente.name}» no tiene cuenta de acceso a la plataforma todavía, así que aún no podrá entrar. El acceso queda guardado y funcionará en cuanto la tenga.`;

  await pool.query(
    `INSERT INTO gcc_world.flow_clients (flow_id, client_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
    [flujo.id, client_id],
  );

  return NextResponse.json({ ok: true, aviso });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error, flujo } = await flujoAdministrablePorHttp(id);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  if (!clientId) return NextResponse.json({ error: 'Falta el cliente' }, { status: 400 });

  await pool.query(
    `DELETE FROM gcc_world.flow_clients WHERE flow_id = $1 AND client_id = $2`,
    [flujo.id, clientId],
  );

  return NextResponse.json({ ok: true });
}
