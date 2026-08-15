import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { MAX_SKILLS } from '@/lib/members/cv-tipos';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await pool.query(`ALTER TABLE gcc_world.member_cv_profiles ADD COLUMN IF NOT EXISTS talents JSONB DEFAULT '[]'::jsonb`);
    const { rows } = await pool.query(
      `SELECT * FROM gcc_world.member_cv_profiles WHERE member_id = $1`,
      [id]
    );

    return NextResponse.json({ cv: rows[0] || null });
  } catch (err: any) {
    console.error('CV GET error:', err.message);
    return NextResponse.json({ cv: null });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    // Las skills son de cada talento desde 2026-08-15. El formulario ya lo impide;
    // esto corta lo que llegue por otro camino. Se responde 400 en vez de recortar en
    // silencio: perder skills sin avisar es peor que un error que se lee.
    const conExceso = (Array.isArray(body.talents) ? body.talents : [])
      .find((t: any) => Array.isArray(t?.skills) && t.skills.length > MAX_SKILLS);
    if (conExceso) {
      return NextResponse.json(
        { error: `Máximo ${MAX_SKILLS} skills por talento («${conExceso.key}»). Deja las más generales.` },
        { status: 400 },
      );
    }

    // ⚠️ `linkedin_url` y `website_url` NO se tocan aquí. Desde 2026-08-14 se editan
    // en «Redes sociales» del panel de Perfil, con el resto de enlaces; este upsert
    // los pisaría a NULL cada vez que alguien guardara el CV.

    // `talents`: [{ key, education[], experience[] }] — talentos del usuario con su
    // educación/experiencia propias (los servicios de cada talento son filas en `services`).
    await pool.query(`ALTER TABLE gcc_world.member_cv_profiles ADD COLUMN IF NOT EXISTS talents JSONB DEFAULT '[]'::jsonb`);

    // Upsert
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.member_cv_profiles (member_id, bio, education, experience, talents)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (member_id) DO UPDATE SET
         bio = EXCLUDED.bio,
         education = EXCLUDED.education,
         experience = EXCLUDED.experience,
         talents = EXCLUDED.talents,
         updated_at = NOW()
       RETURNING *`,
      [id, body.bio || null, JSON.stringify(body.education || []), JSON.stringify(body.experience || []), JSON.stringify(body.talents || [])]
    );

    return NextResponse.json({ cv: rows[0] });
  } catch (err: any) {
    console.error('CV PUT error:', err.message);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}
