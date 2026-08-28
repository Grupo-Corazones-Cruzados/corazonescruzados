import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { flujoPermitido } from '@/lib/flows/acceso';
import { NextResponse } from 'next/server';

/**
 * Un flujo. Lo consume la página de detalle `/dashboard/automatizaciones/[id]`, que necesita
 * el tipo para decidir qué espacio de trabajo montar (email masivo / WhatsApp / agente IA).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // LEER el flujo ya no es solo de administradores: un cliente con acceso tiene que poder
    // abrir su propio flujo. Quién puede lo decide `flujoPermitido()`. Modificarlo y
    // borrarlo siguen siendo de administrador (ver PUT y DELETE más abajo).
    const { id } = await params;
    const flujo = await flujoPermitido(user, id);
    if (!flujo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({ data: flujo });
  } catch (err: any) {
    console.error('Flow GET error:', err.message);
    return NextResponse.json({ error: 'Error al cargar el flujo' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { name, type, description, status, config } = body;

    const { rows } = await pool.query(
      `UPDATE gcc_world.flows
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           description = COALESCE($3, description),
           status = COALESCE($4, status),
           config = COALESCE($5, config),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, type, description, status, config ? JSON.stringify(config) : null, id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    /**
     * ⇒ EN UN AGENTE IA, «ACTIVO» ES UNA SOLA COSA. Ver `sincronizarAgente()`.
     *
     * Este endpoint mueve `flows.status`, que es lo que enseña el panel de
     * Automatizaciones; quien decide si el agente CONTESTA es
     * `agente_canales.bot_activo`. Eran dos interruptores distintos con la misma
     * etiqueta, así que se movían por separado.
     */
    await sincronizarAgente(rows[0], status);

    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Flows PUT error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const { rowCount } = await pool.query(`DELETE FROM gcc_world.flows WHERE id = $1`, [id]);

    if (rowCount === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Flows DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Mantiene a la vez los DOS interruptores de un agente IA.
 *
 * ── POR QUÉ EXISTE (2026-08-28, lo sufrió Fernando) ───────────────────────────────────
 * Un agente tenía dos «activos» independientes y con el mismo nombre en pantalla:
 *   · `flows.status` — lo que dice el panel de Automatizaciones y mueve su botón «Activar».
 *   · `agente_canales.bot_activo` — lo ÚNICO que mira el webhook para decidir si contesta.
 *
 * Fernando pulsó «Activar», la pantalla dijo «Activo», y el agente siguió mudo porque el
 * otro interruptor seguía apagado. Y no había forma de notarlo: con `bot_activo` en falso
 * el webhook **guarda el mensaje y no encola**, sin error y sin traza. Desde fuera se ve
 * exactamente igual que un agente roto.
 *
 * Que la pantalla mienta sobre si el agente atiende a los clientes de alguien no es un
 * detalle de interfaz: es el peor fallo posible de este producto. Así que dejan de ser dos
 * cosas. Se toque el que se toque, los dos van juntos.
 *
 * `draft` no apaga nada: un flujo en borrador todavía no ha llegado a decidir.
 */
async function sincronizarAgente(flujo: any, statusPedido: string | undefined) {
  if (flujo?.type !== 'ai_agent' || !statusPedido) return;
  if (statusPedido !== 'active' && statusPedido !== 'paused') return;
  await pool.query(
    `UPDATE gcc_world.agente_canales SET bot_activo = $2, updated_at = NOW()
      WHERE flow_id = $1 AND bot_activo <> $2`,
    [flujo.id, statusPedido === 'active'],
  );
}
