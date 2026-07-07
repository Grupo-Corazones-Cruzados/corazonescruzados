import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
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
        ORDER BY c.last_seen_at DESC NULLS LAST, c.id DESC`,
    );

    // criteria por candidato: pendiente de fuente de datos (evaluaciones).
    // is_member: el candidato ya fue convertido en miembro (usuario con rol member/admin).
    const data = rows.map((r: any) => ({
      ...r,
      criteria: null,
      is_member: r.user_role === 'member' || r.user_role === 'admin',
    }));
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Candidates list error:', msg);
    return NextResponse.json({ data: [], error: msg }, { status: 500 });
  }
}
