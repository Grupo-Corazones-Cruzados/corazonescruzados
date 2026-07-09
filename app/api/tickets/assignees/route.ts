import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getSubjectsCriteria } from '@/lib/centralized/criteria';
import { sortedTalents, type CandidateCriteria } from '@/lib/centralized/reclutamiento';
import { NextResponse } from 'next/server';

/**
 * Lista de posibles ASIGNADOS de un ticket (para "Solicitar ticket"): candidatos, miembros
 * y admin de la organización, cada uno con su `member_id` (id de asignación en el ticket),
 * su ROL, su PROSPECCIÓN (neto de valores completados − fallidos) y su TOP 5 de TALENTOS.
 * La prospección/talentos se calculan como en Reclutamiento (`getSubjectsCriteria`): para
 * un candidato el sujeto es su fila `clients` (account_type='candidate'); para miembro/admin
 * es su fila `members`.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ data: [] }, { status: 401 });

    // Usuarios con perfil de miembro (member_id). El candidato se detecta por su fila clients.
    const { rows } = await pool.query(
      `SELECT u.member_id::text AS member_id, u.role,
              COALESCE(m.name, u.first_name, u.email) AS name,
              c.id::text AS client_id, c.account_type
         FROM gcc_world.users u
         JOIN gcc_world.members m ON m.id = u.member_id
         LEFT JOIN gcc_world.clients c ON c.user_id = u.id AND c.account_type = 'candidate'
        WHERE u.member_id IS NOT NULL`,
    );

    // Sujetos por tipo para calcular criterios en lote.
    const memberIds: string[] = [];
    const candidateIds: string[] = [];
    for (const r of rows) {
      if (r.account_type === 'candidate' && r.client_id) candidateIds.push(String(r.client_id));
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

    const data = rows.map((r: any) => {
      const isCandidate = r.account_type === 'candidate' && r.client_id;
      const crit = isCandidate ? candCrit[String(r.client_id)] : memberCrit[String(r.member_id)];
      const roleLabel = isCandidate ? 'Candidato' : r.role === 'admin' ? 'Admin' : 'Miembro';
      return {
        member_id: r.member_id,
        name: r.name,
        role: roleLabel,
        prospeccion: prospeccion(crit),
        top_talents: sortedTalents(crit?.talents).slice(0, 5).map((t) => t.name),
      };
    });

    // Orden: mayor prospección primero, luego por nombre.
    data.sort((a: any, b: any) => (b.prospeccion.net - a.prospeccion.net) || a.name.localeCompare(b.name));
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Ticket assignees error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
