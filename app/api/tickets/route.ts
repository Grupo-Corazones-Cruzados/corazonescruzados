import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { ensureUserClientAccount } from '@/lib/tickets/clientAccount';
import { findOrCreatePlaceholderByEmail, resolveMemberId } from '@/lib/clients/account';
import { NextRequest, NextResponse } from 'next/server';
import { TALENTOS_SET } from '@/lib/centralized/talentos';
import { anunciarTicket } from '@/lib/tickets/alta';


/**
 * Columnas que la lista necesita. ⚡ UNA VEZ POR PROCESO (2026-09-28): corrían en CADA
 * petición, y la lista se pide en cada cambio de filtro — cuatro `ALTER TABLE` por clic,
 * cada uno un viaje a la base que además pide el bloqueo exclusivo de la tabla.
 */
let asegurandoColumnas: Promise<void> | null = null;
function asegurarColumnasLista(): Promise<void> {
  const enCurso = asegurandoColumnas ?? (async () => {
    await pool.query(`
      ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);
      ALTER TABLE gcc_world.invoices ADD COLUMN IF NOT EXISTS source_id TEXT;
      ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS open_for_talent BOOLEAN DEFAULT false;
      ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS required_talents TEXT[] DEFAULT '{}';
    `);
  })().catch((e) => { asegurandoColumnas = null; throw e; });
  asegurandoColumnas = enCurso;
  return enCurso;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const openMode = searchParams.get('open') === '1'; // pestaña "Abiertos" (open_for_proposals)
    const search = searchParams.get('search');
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 15);
    const offset = (page - 1) * limit;

    // Base filters (search + client scoping), shared by list, count and per-status counts.
    let baseWhere = 'WHERE 1=1';
    const baseParams: any[] = [];
    if (search) {
      baseParams.push(`%${search}%`);
      baseWhere += ` AND t.title ILIKE $${baseParams.length}`;
    }
    // En la pestaña "Abiertos" el scoping por cliente NO aplica (candidatos/miembros ven todos).
    if (user.role === 'client' && !openMode) {
      baseParams.push(user.userId);
      baseWhere += ` AND t.client_id IN (SELECT id FROM gcc_world.clients WHERE user_id = $${baseParams.length})`;
    }

    // ⭐ BORRADORES (2026-10-07): solo los ve quien los creó, y no cuentan en «Todos» ni en
    // «Abiertos»: tienen su propia pestaña.
    baseParams.push(user.userId);
    baseWhere += ` AND (t.status <> 'draft' OR t.user_id = $${baseParams.length}::uuid)`;

    // "Abierto" = a propuestas (todos) o por talento (solo miembro/admin, sin params → seguro inline).
    const openCond = (user.role === 'admin' || user.role === 'member')
      ? `(t.open_for_proposals = true OR t.open_for_talent = true)`
      : `t.open_for_proposals = true`;

    // Status-filtered where extends the base.
    let where = baseWhere;
    const params: any[] = [...baseParams];
    if (openMode) {
      where += ` AND ${openCond} AND t.status <> 'draft'`;
    } else if (status && status !== 'all') {
      params.push(status);
      where += ` AND t.status = $${params.length}`;
    } else {
      where += ` AND t.status <> 'draft'`;
    }

    await asegurarColumnasLista();

    // Las cuatro lecturas son independientes: salen A LA VEZ, no una tras otra.
    const pagina = [...params, limit, offset];
    const [countsQ, openCountQ, countQ, dataQ] = await Promise.all([
    // Per-status counts (respect base filters, ignore the status filter) for the rail.
    pool.query(
      `SELECT t.status, COUNT(*)::int AS n FROM gcc_world.tickets t ${baseWhere} GROUP BY t.status`,
      baseParams,
    ),
    // Conteo de la pestaña "Abiertos".
    pool.query(
      `SELECT COUNT(*)::int AS n FROM gcc_world.tickets t ${baseWhere} AND ${openCond} AND t.status <> 'draft'`,
      baseParams,
    ),
    pool.query(`SELECT COUNT(*) FROM gcc_world.tickets t ${where}`, params),
    pool.query(
      `SELECT t.*, COALESCE(c.name, inv_info.invoice_client_name) as client_name, m.name as member_name,
              inv_info.invoice_id, inv_info.invoice_sri_status, inv_info.invoice_total
       FROM gcc_world.tickets t
       LEFT JOIN gcc_world.clients c ON c.id = t.client_id
       LEFT JOIN gcc_world.members m ON m.id = t.member_id
       LEFT JOIN LATERAL (
         SELECT id as invoice_id, sri_status as invoice_sri_status, original_total_usd as invoice_total, client_name_sri as invoice_client_name
         FROM gcc_world.invoices
         WHERE source_type = 'ticket' AND source_id = CAST(t.id AS TEXT) AND status != 'cancelled'
         ORDER BY CASE sri_status WHEN 'authorized' THEN 0 ELSE 1 END
         LIMIT 1
       ) inv_info ON true
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${pagina.length - 1} OFFSET $${pagina.length}`,
      pagina
    ),
    ]);
    const counts: Record<string, number> = {};
    let allCount = 0;
    for (const r of countsQ.rows) { counts[r.status] = Number(r.n); if (r.status !== 'draft') allCount += Number(r.n); }
    counts.all = allCount;
    counts.open = Number(openCountQ.rows[0].n);

    return NextResponse.json({ data: dataQ.rows, total: Number(countQ.rows[0].count), counts });
  } catch (err: any) {
    console.error('Tickets error:', err.message);
    // ⚠️ Antes respondía 200 con la lista vacía: un fallo se leía como «no hay tickets».
    return NextResponse.json({ error: 'No se pudo cargar la lista de tickets', data: [], total: 0, counts: {} }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { title, description, service_id, member_id, client_id, client_email, deadline, estimated_hours, estimated_cost, time_slots } = body;
    // mode: 'create' = YO soy el miembro asignado y elijo cliente; 'request' = YO soy el
    // cliente (mi cuenta cliente) y elijo un miembro o dejo el ticket abierto a propuestas.
    const mode: 'create' | 'request' = body.mode === 'request' ? 'request' : 'create';
    const openForProposals = mode === 'request' && body.open_for_proposals === true;
    // Modo "por talento": abierto solo a miembros con el talento requerido (toman de inmediato).
    const openForTalent = mode === 'request' && body.open_for_talent === true;

    /**
     * BORRADOR (Fernando, 2026-10-07). Solo en «Nuevo ticket» (el que lo crea es quien lo
     * atiende): nace en 'draft', privado, y no habla con nadie hasta enviarlo. Es lo que se
     * crea sin conexión: `offline_id` lo pone el dispositivo, y si la misma subida llega dos
     * veces se devuelve el borrador ya creado en vez de duplicarlo.
     */
    const esBorrador = mode === 'create' && body.borrador === true;
    const offlineId = esBorrador && typeof body.offline_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.offline_id)
      ? body.offline_id : null;
    if (offlineId) {
      const { rows: ya } = await pool.query(
        `SELECT * FROM gcc_world.tickets WHERE offline_id = $1 AND user_id = $2`, [offlineId, user.userId],
      );
      if (ya[0]) return NextResponse.json({ data: ya[0], repetido: true });
    }

    /**
     * ⭐ EL TALENTO ES OBLIGATORIO EN TODO TICKET (Fernando, 2026-08-18).
     *
     * Antes solo se guardaba cuando el ticket se abría «por talento» —uno de tres caminos—,
     * así que los otros dos dejaban la lista vacía. Resultado medido en producción: **los 19
     * tickets terminados no declaraban ninguno**, y la página `/soluciones`, que enseña el
     * trabajo hecho por talento, habría mostrado siempre la mitad vacía.
     *
     * El campo pasa a tener DOS oficios, y por eso se pide siempre:
     *   · decide **quién puede tomar** el ticket, si está abierto por talento;
     *   · **clasifica** el ticket, que es lo que lo coloca bajo una solución en la web.
     *
     * Se filtra contra el catálogo (`TALENTOS_SET`) por el mismo motivo que en los soluciones:
     * un talento inventado no casaría nunca con nada y dejaría el ticket fuera de toda
     * carpeta, sin que nadie supiera por qué.
     */
    const talentosPedidos: string[] = Array.isArray(body.required_talents)
      ? body.required_talents.filter((t: any) => typeof t === 'string' && t.trim())
      : [];
    const requiredTalents = [...new Set(talentosPedidos.filter((t) => TALENTOS_SET.has(t)))];

    if (!title?.trim()) {
      return NextResponse.json({ error: 'El titulo es requerido' }, { status: 400 });
    }
    // El talento se exige al ENVIAR un borrador, no al crearlo: sin conexión no se puede
    // consultar nada y el borrador es justamente lo que aún no está completo.
    if (requiredTalents.length === 0 && !esBorrador) {
      // Se distingue «no mandaste ninguno» de «mandaste nombres que no existen»: el segundo
      // caso, con un mensaje genérico, deja a quien lo sufre sin saber qué corregir.
      return NextResponse.json({
        error: talentosPedidos.length
          ? 'Ninguno de los talentos enviados existe en el catálogo de la organización.'
          : 'Selecciona al menos un talento para el ticket.',
      }, { status: 400 });
    }

    // Columnas para los modos "abierto" (a propuestas / por talento).
    await pool.query(`ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS open_for_proposals BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS open_for_talent BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS required_talents TEXT[] DEFAULT '{}'`);

    // Miembro asignado: en 'request' abierto (propuestas o talento) no hay miembro (queda null).
    const resolvedMemberId = (openForProposals || openForTalent) ? null : (member_id || null);

    // Resolve client: by ID, by email (find or create), or auto for client role
    let resolvedClientId = client_id || null;
    let resolvedClientEmail = client_email?.trim() || null;

    // En modo SOLICITAR, el cliente es la cuenta de tipo cliente del propio usuario
    // (candidato/miembro/admin) — se crea si no existe.
    if (mode === 'request' && !resolvedClientId) {
      resolvedClientId = await ensureUserClientAccount(user.userId);
      if (resolvedClientId) {
        const { rows: [c] } = await pool.query(`SELECT email FROM gcc_world.clients WHERE id = $1`, [resolvedClientId]);
        resolvedClientEmail = c?.email || resolvedClientEmail;
      }
    }

    let invitePlaceholderEmail: string | null = null;
    // Borrador con cliente por correo: solo se guarda el correo (ver `draft_client_email`).
    const correoDeBorrador = esBorrador && !resolvedClientId ? resolvedClientEmail : null;
    if (esBorrador) {
      // nada: ni ficha de cliente ni invitación hasta enviarlo
    } else if (!resolvedClientId && resolvedClientEmail) {
      // RUTA 3: por correo → reusa el cliente existente o crea un placeholder inactivo,
      // ligado al miembro que lo crea (para "mis clientes"). Si es nuevo, se le invita.
      const createdBy = await resolveMemberId(user.userId);
      const ph = await findOrCreatePlaceholderByEmail(resolvedClientEmail, createdBy);
      resolvedClientId = ph?.id ?? null;
      if (ph?.created) invitePlaceholderEmail = resolvedClientEmail;
    } else if (resolvedClientId && !resolvedClientEmail) {
      // Get email from existing client for notification
      const { rows: [c] } = await pool.query(`SELECT email FROM gcc_world.clients WHERE id = $1`, [resolvedClientId]);
      resolvedClientEmail = c?.email || null;
    }

    if (user.role === 'client' && !resolvedClientId) {
      const clientRes = await pool.query(
        `SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`,
        [user.userId]
      );
      if (clientRes.rows.length > 0) resolvedClientId = clientRes.rows[0].id;
    }

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.tickets (title, description, service_id, member_id, client_id, deadline, estimated_hours, estimated_cost, status, user_id, open_for_proposals, open_for_talent, required_talents, offline_id, draft_client_email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $13, $9, $10, $11, $12::text[], $14, $15, NOW(), NOW())
       RETURNING *`,
      [
        title.trim(),
        description?.trim() || null,
        service_id || null,
        resolvedMemberId,
        resolvedClientId,
        deadline || null,
        estimated_hours || null,
        estimated_cost || null,
        user.userId,
        openForProposals,
        openForTalent,
        requiredTalents,
        esBorrador ? 'draft' : 'pending',
        offlineId,
        correoDeBorrador,
      ]
    );

    const ticket = rows[0];

    // Insert time slots if provided
    if (Array.isArray(time_slots) && time_slots.length > 0) {
      await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.ticket_time_slots (
        id SERIAL PRIMARY KEY,
        ticket_id INT NOT NULL,
        date DATE NOT NULL,
        start_time TEXT,
        end_time TEXT,
        status VARCHAR(20) DEFAULT 'scheduled',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`);
      for (const slot of time_slots) {
        if (!slot.date) continue;
        await pool.query(
          `INSERT INTO gcc_world.ticket_time_slots (ticket_id, date, start_time, end_time, status, created_at)
           VALUES ($1, $2, $3, $4, 'scheduled', NOW())`,
          [ticket.id, slot.date, slot.start_time || null, slot.end_time || null]
        );
      }
    }

    // Un BORRADOR no habla con nadie: el correo al cliente, el aviso al miembro y la
    // invitación salen al enviarlo (`/api/tickets/[id]/enviar`).
    if (!esBorrador) {
      await anunciarTicket(ticket, { mode, resolvedMemberId, resolvedClientEmail, invitePlaceholderEmail });
    }

    return NextResponse.json({ data: ticket }, { status: 201 });
  } catch (err: any) {
    // Dos subidas del mismo borrador a la vez: el índice único deja pasar una; la otra
    // devuelve la que entró.
    if (err?.code === '23505' && String(err?.constraint || '').includes('offline_id')) {
      try {
        const b = await req.clone().json().catch(() => ({}));
        const { rows } = await pool.query(`SELECT * FROM gcc_world.tickets WHERE offline_id = $1`, [b.offline_id]);
        if (rows[0]) return NextResponse.json({ data: rows[0], repetido: true });
      } catch { /* cae al error de abajo */ }
    }
    console.error('Ticket create error:', err.message);
    return NextResponse.json({ error: 'Error al crear ticket' }, { status: 500 });
  }
}
