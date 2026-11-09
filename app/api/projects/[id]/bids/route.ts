import { pool } from '@/lib/db';
import { sincronizarCostoProyecto } from '@/lib/payments';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { addParticipant } from '@/lib/projects/members';
import { esGestorDelProyecto, miembroDe } from '@/lib/projects/permisos';
import { encaja, talentosAbiertosDelProyecto, top5DeMiembro } from '@/lib/talentos/demostrados';
import { motivoSinSegundoBeneficiario } from '@/lib/ganancias';

async function ensureColumns() {
  await pool.query(`ALTER TABLE gcc_world.project_bids ADD COLUMN IF NOT EXISTS requirement_costs JSONB DEFAULT '{}'`);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT pb.*, m.name as member_name, m.email as member_email, m.photo_url
       FROM gcc_world.project_bids pb
       JOIN gcc_world.members m ON m.id = pb.member_id
       WHERE pb.project_id = $1
       ORDER BY pb.created_at`,
      [id]
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    await ensureColumns();

    // La propuesta es SIEMPRE del miembro de la sesión (2026-11-09): antes `member_id` venía del
    // cuerpo y `bid_id` actualizaba cualquier propuesta de cualquier proyecto.
    const yo = await miembroDe(String(user.userId));
    if (yo == null) return NextResponse.json({ error: 'Necesitas un perfil de miembro para proponer' }, { status: 403 });

    // ⭐ Se propone a lo que pide tu talento DEMOSTRADO (top 5; Fernando, 2026-11-09): cada
    // requerimiento elegido tiene que pedir alguno de tus talentos; sin requerimientos, alguno
    // de los que pide el proyecto. Un requerimiento sin talentos no exige nada.
    {
      const reqIds = (Array.isArray(body.requirement_ids) ? body.requirement_ids : []).map(String).filter((x: string) => /^\d+$/.test(x));
      const top = await top5DeMiembro(yo);
      if (reqIds.length) {
        const { rows: reqs } = await pool.query(
          `SELECT talents FROM gcc_world.project_requirements WHERE project_id = ($1)::bigint AND id = ANY($2::bigint[])`,
          [id, reqIds],
        );
        if (reqs.length !== reqIds.length) return NextResponse.json({ error: 'Algún requerimiento no es de este proyecto' }, { status: 400 });
        if (reqs.some((r: any) => !encaja(top, r.talents))) {
          return NextResponse.json({ error: 'Solo puedes proponerte a requerimientos que pidan alguno de tus talentos demostrados (tus 5 primeros).' }, { status: 400 });
        }
      } else if (!encaja(top, await talentosAbiertosDelProyecto(id))) {
        return NextResponse.json({ error: 'Este proyecto no pide ninguno de tus talentos demostrados (tus 5 primeros).' }, { status: 400 });
      }
    }

    // Update existing bid (member submitting proposal)
    if (body.bid_id) {
      const { rows } = await pool.query(
        `UPDATE gcc_world.project_bids
         SET proposal = $1, bid_amount = $2, requirement_ids = $3, work_dates = $4, requirement_costs = $5, status = 'pending', updated_at = NOW()
         WHERE id = $6 AND project_id = $7 AND member_id = $8 AND status IN ('invited', 'pending') RETURNING *`,
        [body.proposal, body.bid_amount, body.requirement_ids || [], body.work_dates || [], JSON.stringify(body.requirement_costs || {}), body.bid_id, id, yo]
      );
      if (!rows[0]) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 });
      return NextResponse.json({ data: rows[0] });
    }

    // Create new bid
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.project_bids (project_id, member_id, proposal, bid_amount, estimated_days, requirement_ids, requirement_costs, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (project_id, member_id) DO NOTHING
       RETURNING *`,
      [id, yo, body.proposal || null, body.bid_amount || null, body.estimated_days || null, body.requirement_ids || [], JSON.stringify(body.requirement_costs || {}), 'pending']
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id: projectId } = await params;
    const { bid_id, status } = await req.json();

    if (!bid_id || !status) return NextResponse.json({ error: 'bid_id and status required' }, { status: 400 });
    if (!['accepted', 'rejected'].includes(status)) return NextResponse.json({ error: 'Estado no válido' }, { status: 400 });
    // Aceptar o rechazar es del gestor del proyecto (admin, creador o responsable), y la
    // propuesta tiene que ser de ESTE proyecto (2026-11-09: antes cualquiera aceptaba cualquiera).
    if (!(await esGestorDelProyecto({ userId: String(user.userId), role: user.role }, projectId))) {
      return NextResponse.json({ error: 'Solo el responsable del proyecto decide las propuestas' }, { status: 403 });
    }

    // ⭐ Una propuesta con requerimientos hace beneficiario a quien la manda, y un plan de etapas admite uno solo
    // (Fernando, 2026-11-09). Se mira ANTES de aceptarla: después ya habría quedado aceptada a medias.
    if (status === 'accepted') {
      const { rows: [previa] } = await pool.query(
        `SELECT member_id, requirement_ids FROM gcc_world.project_bids WHERE id = $1 AND project_id = $2`, [bid_id, projectId],
      );
      if (previa && (previa.requirement_ids?.length ?? 0) > 0) {
        const bloqueo = await motivoSinSegundoBeneficiario(projectId, previa.member_id);
        if (bloqueo) return NextResponse.json({ error: bloqueo }, { status: 409 });
      }
    }

    const { rows } = await pool.query(
      `UPDATE gcc_world.project_bids SET status = $1, updated_at = NOW() WHERE id = $2 AND project_id = $3 RETURNING *`,
      [status, bid_id, projectId]
    );
    if (!rows[0]) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 });

    const bid = rows[0];

    // Al aceptar una propuesta, el miembro queda como PARTICIPANTE del proyecto.
    if (status === 'accepted' && bid) {
      await addParticipant(projectId, bid.member_id).catch(() => undefined);
    }

    // When accepting a bid, auto-create requirement assignments
    if (status === 'accepted' && bid && bid.requirement_ids?.length > 0) {
      const costs = bid.requirement_costs || {};

      for (const reqId of bid.requirement_ids) {
        const cost = Number(costs[String(reqId)]) || 0;
        // Check if this member is already assigned to this requirement
        const existing = await pool.query(
          `SELECT 1 FROM gcc_world.requirement_assignments WHERE requirement_id = $1 AND member_id = $2 LIMIT 1`,
          [reqId, bid.member_id]
        );
        if (existing.rows.length === 0) {
          await pool.query(
            `INSERT INTO gcc_world.requirement_assignments (project_id, requirement_id, member_id, proposed_cost, status)
             VALUES ($1, $2, $3, $4, 'accepted')`,
            [projectId, reqId, bid.member_id, cost]
          );
        }
      }

      await sincronizarCostoProyecto(projectId);
    }

    return NextResponse.json({ data: bid });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
