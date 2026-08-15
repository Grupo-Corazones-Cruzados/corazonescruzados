import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureRequirementColumns, normalizeTalents, talentsAggSql } from '@/lib/projects/requirements';

export async function GET(req: NextRequest) {
  try {
    // Lectura pública: el catálogo del marketplace (proyectos publicados y
    // completados) se muestra también a visitantes sin sesión (/marketplace-publico).
    // Solo el filtro `member=true` (vista de portafolio del miembro) exige sesión.
    const user = await getCurrentUser();
    const search = req.nextUrl.searchParams.get('search');
    const memberOnly = req.nextUrl.searchParams.get('member') === 'true';
    if (memberOnly && !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Ensure columns exist
    await pool.query(`
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS is_marketplace_published BOOLEAN DEFAULT false;
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS marketplace_published_at TIMESTAMPTZ;
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS images TEXT[];
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_docs_token VARCHAR(64);
    `);

    await ensureRequirementColumns();

    // `baseWhere` = visibilidad + búsqueda. El filtro por TALENTO se añade encima, para
    // poder calcular con la base las opciones del propio filtro (si no, al elegir un
    // talento desaparecerían los demás del desplegable).
    let where = `WHERE p.is_marketplace_published = true AND p.status = 'completed'`;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      where += ` AND p.title ILIKE $${params.length}`;
    }

    // Filter by current user's member_id (for portfolio view)
    if (memberOnly && user!.role !== 'admin') {
      const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user!.userId]);
      if (u?.member_id) {
        params.push(u.member_id);
        where += ` AND EXISTS (SELECT 1 FROM gcc_world.project_bids pb2 WHERE pb2.project_id = p.id AND pb2.member_id = $${params.length} AND pb2.status = 'accepted')`;
      }
    }

    const baseWhere = where;
    const baseParams = [...params];

    // Filtro por TALENTO: encaja el proyecto si ALGUNO de sus requerimientos pide
    // alguno de los talentos buscados.
    const talents = normalizeTalents((req.nextUrl.searchParams.get('talents') || '').split(',').filter(Boolean));
    if (talents.length) {
      params.push(talents);
      where += ` AND EXISTS (SELECT 1 FROM gcc_world.project_requirements pr
                              WHERE pr.project_id = p.id AND pr.talents && $${params.length}::text[])`;
    }

    const { rows } = await pool.query(
      `SELECT p.id, p.title, p.description, p.final_cost, COALESCE(p.tags, '{}') AS tags,
              p.marketplace_published_at, p.created_at,
              p.public_docs_token,
              COALESCE(array_length(p.images, 1), 0)::int as image_count,
              COALESCE(
                (SELECT json_agg(json_build_object('name', m.name, 'photo_url', m.photo_url))
                 FROM gcc_world.project_bids pb
                 JOIN gcc_world.members m ON m.id = pb.member_id
                 WHERE pb.project_id = p.id AND pb.status = 'accepted'),
                '[]'::json
              ) as team,
              (SELECT COUNT(*) FROM gcc_world.project_requirements r WHERE r.project_id = p.id) as requirements_count,
              COALESCE((SELECT SUM(r.slots)::int FROM gcc_world.project_requirements r WHERE r.project_id = p.id), 0) as slots_total,
              ${talentsAggSql('p')} as talents
       FROM gcc_world.projects p
       ${where}
       ORDER BY p.marketplace_published_at DESC`,
      params
    );

    // Talentos disponibles para el desplegable del filtro: los que de verdad piden los
    // proyectos visibles (así nunca se ofrece un talento que daría cero resultados).
    const { rows: opt } = await pool.query(
      `SELECT DISTINCT t AS talent
         FROM gcc_world.projects p
         JOIN gcc_world.project_requirements pr ON pr.project_id = p.id, UNNEST(pr.talents) AS t
         ${baseWhere}
         ORDER BY 1`,
      baseParams,
    );

    return NextResponse.json({ data: rows, talentOptions: opt.map((r: any) => r.talent) });
  } catch (err: any) {
    console.error('Marketplace projects error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
