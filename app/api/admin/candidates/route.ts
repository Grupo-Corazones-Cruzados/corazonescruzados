import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getDimensionProblemLoads } from '@/lib/centralized/apoyo-db';
import { getSubjectsProfileScores } from '@/lib/centralized/horario-db';
import { NextResponse } from 'next/server';

/**
 * Lista de CANDIDATOS del sistema de Reclutamiento y Selección (solo admin):
 * postulantes ya **aprobados** que además **iniciaron sesión y completaron su perfil**
 * (`clients.account_type='candidate' AND approved AND profile_completed`).
 *
 * Los criterios (Talento/Valores/Dimensiones/Apoyo) aún no tienen fuente de datos, así
 * que se devuelve `criteria: null` por ahora; la UI los muestra como "sin evaluar".
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ data: [] }, { status: 403 });
    }

    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.full_name, c.email, c.phone, c.company, c.country, c.alias,
              c.last_seen_at, c.created_at, c.user_id,
              u.role AS user_role, u.member_id
         FROM gcc_world.clients c
         LEFT JOIN gcc_world.users u ON u.id = c.user_id
        WHERE c.account_type = 'candidate' AND c.approved = true AND c.profile_completed = true
          -- Excluir a los que ya fueron convertidos en miembro (usuario member/admin).
          AND (u.role IS NULL OR u.role NOT IN ('member', 'admin'))
        ORDER BY c.last_seen_at DESC NULLS LAST, c.id DESC`,
    );

    // Criterios calculados:
    //  - Dimensiones: carga de problemas por dimensión (Apoyo y Autoayuda).
    //  - Talento y Valores: cumplimiento de tareas del Horario de Vida (± por etiqueta).
    // Apoyo sigue pendiente de fuente de datos.
    const ids = rows.map((r: any) => String(r.id));
    const [loads, scores] = await Promise.all([
      getDimensionProblemLoads('candidate', ids),
      getSubjectsProfileScores('candidate', ids),
    ]);
    const data = rows.map((r: any) => {
      const sid = String(r.id);
      const dims = loads[sid];
      const sc = scores[sid];
      const criteria = (dims || sc) ? {
        talents: sc?.talents || [],
        values: {},
        valuesBalance: sc?.valuesBalance || {},
        dimensions: dims || {},
        apoyo: {},
      } : null;
      return {
        ...r,
        criteria,
        is_member: r.user_role === 'member' || r.user_role === 'admin',
      };
    });
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Candidates list error:', msg);
    return NextResponse.json({ data: [], error: msg }, { status: 500 });
  }
}
