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
      `SELECT id, name, full_name, email, phone, company, country, alias,
              last_seen_at, created_at, user_id
         FROM gcc_world.clients
        WHERE account_type = 'candidate' AND approved = true AND profile_completed = true
        ORDER BY last_seen_at DESC NULLS LAST, id DESC`,
    );

    // criteria por candidato: pendiente de fuente de datos (evaluaciones).
    const data = rows.map((r: any) => ({ ...r, criteria: null }));
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Candidates list error:', msg);
    return NextResponse.json({ data: [], error: msg }, { status: 500 });
  }
}
