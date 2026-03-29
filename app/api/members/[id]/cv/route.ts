import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
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

    // Upsert
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.member_cv_profiles (member_id, bio, skills, languages, linkedin_url, website_url, education, experience)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (member_id) DO UPDATE SET
         bio = EXCLUDED.bio,
         skills = EXCLUDED.skills,
         languages = EXCLUDED.languages,
         linkedin_url = EXCLUDED.linkedin_url,
         website_url = EXCLUDED.website_url,
         education = EXCLUDED.education,
         experience = EXCLUDED.experience,
         updated_at = NOW()
       RETURNING *`,
      [id, body.bio || null, body.skills || [], body.languages || [], body.linkedin_url || null, body.website_url || null, JSON.stringify(body.education || []), JSON.stringify(body.experience || [])]
    );

    return NextResponse.json({ cv: rows[0] });
  } catch (err: any) {
    console.error('CV PUT error:', err.message);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}
