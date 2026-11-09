import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getSubjectsCriteria } from '@/lib/centralized/criteria';
import { sortedTalents, type CandidateCriteria } from '@/lib/centralized/reclutamiento';
import { TOP_TALENTOS, encaja, talentosAbiertosDelProyecto, talentosDelRequerimiento } from '@/lib/talentos/demostrados';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Lista de PERSONAS elegibles para un trabajo (selectores de ticket y de proyecto): candidatos,
 * miembros y admin, cada uno con su `member_id` (id de asignación), su ROL, su PROSPECCIÓN (neto
 * de valores completados − fallidos) y su TOP 5 de TALENTOS DEMOSTRADOS.
 *
 * ⭐ SOLO SALE QUIEN TIENE DEMOSTRADO EL TALENTO (Fernando, 2026-11-09). El contexto llega en la
 * URL —uno de los cuatro—:
 *   · `talentos=a,b`       los del formulario (crear ticket o proyecto: el talento va antes)
 *   · `ticket=<id>`        los `required_talents` del ticket
 *   · `proyecto=<id>`      los que pide el proyecto (los suyos + requerimientos con plazas)
 *   · `requerimiento=<id>` los del requerimiento
 * Sale quien tiene ALGUNO de ellos en su top 5. Sin contexto, o si el trabajo no pide ninguno,
 * no se filtra. Quien pregunta sale SIEMPRE (elegirse a uno mismo vale) y también los ids de
 * `incluir` (el asignado actual al editar, para que no desaparezca del selector). Las rutas que
 * guardan la elección lo vuelven a comprobar: la lista no es la defensa.
 *
 * Talentos y prospección salen de `getSubjectsCriteria`, cuyo bloque de talentos es la cuenta
 * única de `lib/talentos/demostrados.ts`. El sujeto de un candidato es su fila `clients`; el de
 * miembro/admin, su fila `members`.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ data: [] }, { status: 401 });
    const sp = req.nextUrl.searchParams;

    // ── Talentos que pide el trabajo ──
    let pedidos: string[] | null = null;
    const lista = (v: string | null) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (sp.has('talentos')) pedidos = lista(sp.get('talentos'));
    else if (/^\d+$/.test(sp.get('requerimiento') || '')) pedidos = await talentosDelRequerimiento(sp.get('requerimiento')!);
    else if (/^\d+$/.test(sp.get('proyecto') || '')) pedidos = await talentosAbiertosDelProyecto(sp.get('proyecto')!);
    else if (/^\d+$/.test(sp.get('ticket') || '')) {
      const { rows: [t] } = await pool.query(`SELECT required_talents FROM gcc_world.tickets WHERE id = $1`, [sp.get('ticket')]);
      pedidos = (t?.required_talents || []).filter(Boolean);
    }
    const incluir = new Set(lista(sp.get('incluir')));

    // Personas con ficha de miembro: admin, miembro o candidato (rol cliente con fila
    // `clients` de tipo candidato). Un cliente sin más no oferta ni se asigna.
    const { rows } = await pool.query(
      `SELECT u.id::text AS user_id, u.member_id::text AS member_id, u.role,
              COALESCE(m.name, u.first_name, u.email) AS name, COALESCE(m.email, u.email) AS email,
              c.id::text AS client_id, c.account_type
         FROM gcc_world.users u
         JOIN gcc_world.members m ON m.id = u.member_id
         LEFT JOIN gcc_world.clients c ON c.user_id = u.id AND c.account_type = 'candidate'
        WHERE u.member_id IS NOT NULL
          AND (u.role IN ('admin', 'member') OR c.id IS NOT NULL)`,
    );

    // ¿El usuario es realmente un CANDIDATO? Solo si su ROL no es admin/miembro y tiene fila
    // `clients` candidate. Un admin/miembro puede tener además una cuenta de candidato de
    // pruebas; su rol manda y NO debe rebajarse a "Candidato" (subject = su fila members).
    const isCandidateRow = (r: any) =>
      r.role !== 'admin' && r.role !== 'member' && r.account_type === 'candidate' && !!r.client_id;

    // Sujetos por tipo para calcular criterios en lote.
    const memberIds: string[] = [];
    const candidateIds: string[] = [];
    for (const r of rows) {
      if (isCandidateRow(r)) candidateIds.push(String(r.client_id));
      else memberIds.push(String(r.member_id));
    }
    const [memberCrit, candCrit] = await Promise.all([
      getSubjectsCriteria('member', memberIds),
      getSubjectsCriteria('candidate', candidateIds),
    ]);

    const prospeccion = (crit: CandidateCriteria | null) => {
      const vb = crit?.valuesBalance || {};
      let pos = 0, neg = 0;
      for (const k of Object.keys(vb)) { pos += vb[k].completed || 0; neg += vb[k].failed || 0; }
      return { net: pos - neg, pos, neg };
    };

    const vistos = new Set<string>();
    const data = rows.flatMap((r: any) => {
      // Un miembro con dos usuarios saldría dos veces.
      if (vistos.has(String(r.member_id))) return [];
      vistos.add(String(r.member_id));
      const isCandidate = isCandidateRow(r);
      const crit = isCandidate ? candCrit[String(r.client_id)] : memberCrit[String(r.member_id)];
      const top = sortedTalents(crit?.talents).slice(0, TOP_TALENTOS).map((t) => t.name);
      const soyYo = String(r.user_id) === String(user.userId);
      if (pedidos && !soyYo && !incluir.has(String(r.member_id)) && !encaja(top, pedidos)) return [];
      const roleLabel = isCandidate ? 'Candidato' : r.role === 'admin' ? 'Admin' : 'Miembro';
      return [{
        member_id: r.member_id,
        name: r.name,
        email: r.email,
        role: roleLabel,
        prospeccion: prospeccion(crit),
        top_talents: top,
      }];
    });

    // Orden: mayor prospección primero, luego por nombre.
    data.sort((a: any, b: any) => (b.prospeccion.net - a.prospeccion.net) || a.name.localeCompare(b.name));
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Ticket assignees error:', err.message);
    // Una lista vacía con 200 se leería como «nadie tiene el talento».
    return NextResponse.json({ error: 'No se pudo cargar la lista de personas', data: [] }, { status: 500 });
  }
}
