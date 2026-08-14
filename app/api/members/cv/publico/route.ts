/**
 * Ajustes del CV público: titular, ubicación, aspiración salarial, disponibilidad
 * laboral y qué datos de contacto se publican.
 *
 * ── POR QUÉ NO SE AMPLÍA `PUT /api/members/[id]/cv` ───────────────────────────
 * Ese endpoint hace un **upsert completo** del CV: manda bio, skills, idiomas,
 * enlaces y talentos, y lo que no viaja se pisa. Llamarlo desde el panel de Perfil
 * —que no conoce ni carga esos campos— borraría el CV entero al guardar un sueldo.
 * Así que estos campos tienen su propia puerta, con un `UPDATE` parcial.
 *
 * ── DOS PANELES, UN ENDPOINT ──────────────────────────────────────────────────
 * Perfil escribe titular/ubicación/salario/contacto y Disponibilidad escribe los
 * `job_*`. Cada uno manda **solo sus campos** y el resto no se toca: por eso el SQL
 * se arma con las claves presentes y no con una lista fija.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { memberIdDeUsuario } from '@/lib/members/cv-share';

const ESTADOS = ['immediate', 'from_date', 'not_available'];
const JORNADAS = ['full', 'part', 'both'];
const MODALIDADES = ['remote', 'hybrid', 'onsite', 'any'];

/** Campo → cómo se limpia lo que llega. Lo que no esté aquí NO se escribe. */
const CAMPOS: Record<string, (v: any) => any> = {
  headline: (v) => (String(v ?? '').trim() || null),
  location: (v) => (String(v ?? '').trim() || null),
  salary_min: (v) => numeroONulo(v),
  salary_max: (v) => numeroONulo(v),
  salary_visible: (v) => !!v,
  job_status: (v) => (ESTADOS.includes(v) ? v : 'immediate'),
  job_available_from: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? v : null),
  job_workday: (v) => (JORNADAS.includes(v) ? v : 'full'),
  job_mode: (v) => (MODALIDADES.includes(v) ? v : 'any'),
  job_note: (v) => (String(v ?? '').trim().slice(0, 400) || null),
  share_email: (v) => !!v,
  share_phone: (v) => !!v,
};

function numeroONulo(v: any): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  // Tope defensivo: un sueldo mensual de ocho cifras es un dedazo, no un dato.
  return Math.min(n, 9_999_999);
}

async function miMemberId() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  const memberId = await memberIdDeUsuario(user.userId);
  if (!memberId) return { error: NextResponse.json({ error: 'Not a member' }, { status: 403 }) };
  return { memberId };
}

export async function GET() {
  try {
    const { error, memberId } = await miMemberId();
    if (error) return error;
    const { rows } = await pool.query(
      `SELECT headline, location, salary_min, salary_max, salary_visible,
              job_status, job_available_from, job_workday, job_mode, job_note,
              share_email, share_phone
         FROM gcc_world.member_cv_profiles WHERE member_id = $1`,
      [memberId],
    );
    const r = rows[0] || {};
    return NextResponse.json({
      headline: r.headline ?? '',
      location: r.location ?? '',
      salary_min: r.salary_min != null ? Number(r.salary_min) : null,
      salary_max: r.salary_max != null ? Number(r.salary_max) : null,
      salary_visible: r.salary_visible ?? true,
      job_status: r.job_status ?? 'immediate',
      job_available_from: r.job_available_from
        ? new Date(r.job_available_from).toISOString().slice(0, 10)
        : '',
      job_workday: r.job_workday ?? 'full',
      job_mode: r.job_mode ?? 'any',
      job_note: r.job_note ?? '',
      share_email: r.share_email ?? false,
      share_phone: r.share_phone ?? false,
    });
  } catch (err: any) {
    console.error('CV público GET ajustes error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { error, memberId } = await miMemberId();
    if (error) return error;

    const body = await req.json();
    const claves = Object.keys(CAMPOS).filter((k) => k in body);
    if (!claves.length) return NextResponse.json({ error: 'Nada que guardar' }, { status: 400 });

    const valores = claves.map((k) => CAMPOS[k](body[k]));

    // El rango invertido se corrige aquí además de en el CHECK de la base: dejar que
    // reviente la restricción daría un 500 sin decirle a la persona qué pasa.
    const iMin = claves.indexOf('salary_min');
    const iMax = claves.indexOf('salary_max');
    if (iMin >= 0 && iMax >= 0 && valores[iMin] != null && valores[iMax] != null && valores[iMin] > valores[iMax]) {
      return NextResponse.json(
        { error: 'El mínimo de la aspiración salarial no puede ser mayor que el máximo' },
        { status: 400 },
      );
    }

    // La fila del CV puede no existir (miembro que nunca abrió la pestaña «Mi CV»).
    await pool.query(
      `INSERT INTO gcc_world.member_cv_profiles (member_id)
       VALUES ($1) ON CONFLICT (member_id) DO NOTHING`,
      [memberId],
    );

    const sets = claves.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE gcc_world.member_cv_profiles
          SET ${sets}, updated_at = NOW()
        WHERE member_id = $1
        RETURNING member_id`,
      [memberId, ...valores],
    );

    return NextResponse.json({ ok: rows.length > 0 });
  } catch (err: any) {
    console.error('CV público PATCH error:', err.message);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}
